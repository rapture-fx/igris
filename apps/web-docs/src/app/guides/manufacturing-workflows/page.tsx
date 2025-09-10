'use client'

import { CheckCircleIcon, ExclamationTriangleIcon, CogIcon, ChartBarIcon } from '@heroicons/react/24/outline'
import { CodeBlock } from '../../../components/ui/CodeBlock'

export default function ManufacturingWorkflowsPage() {
  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">Manufacturing Workflow Best Practices</h1>
        <p className="text-gray-600 text-lg">
          Comprehensive guide to implementing Industry 4.0 manufacturing workflows with Schlep Engine, 
          covering IoT integration, predictive maintenance, quality control, and smart factory automation.
        </p>
      </div>

      {/* Overview */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-8 border border-orange-100">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Smart Manufacturing Workflow</h2>
        <div className="grid md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-orange-600 text-white rounded-lg flex items-center justify-center mx-auto mb-3">
              1
            </div>
            <h3 className="font-medium text-gray-900">Data Collection</h3>
            <p className="text-sm text-gray-600 mt-1">IoT sensors, OPC-UA, MQTT integration</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-600 text-white rounded-lg flex items-center justify-center mx-auto mb-3">
              2
            </div>
            <h3 className="font-medium text-gray-900">Analytics & ML</h3>
            <p className="text-sm text-gray-600 mt-1">Predictive maintenance, quality analytics</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-green-600 text-white rounded-lg flex items-center justify-center mx-auto mb-3">
              3
            </div>
            <h3 className="font-medium text-gray-900">Automation</h3>
            <p className="text-sm text-gray-600 mt-1">MES integration, workflow automation</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-600 text-white rounded-lg flex items-center justify-center mx-auto mb-3">
              4
            </div>
            <h3 className="font-medium text-gray-900">Optimization</h3>
            <p className="text-sm text-gray-600 mt-1">Digital twins, process optimization</p>
          </div>
        </div>
      </div>

      {/* Phase 1: IoT Data Collection Workflow */}
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Phase 1: Industrial IoT Data Collection</h2>
        
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <CogIcon className="h-5 w-5 text-orange-600 mr-2" />
              Multi-Protocol IoT Integration
            </h3>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">1. Equipment Discovery and Configuration</h4>
                <CodeBlock
                  code={`# Comprehensive equipment discovery and setup
from schlep_engine import ManufacturingIoT, EquipmentRegistry
import asyncio

iot_client = ManufacturingIoT(api_key="your_api_key")
equipment_registry = EquipmentRegistry(api_key="your_api_key")

async def discover_and_configure_equipment():
    """Automated equipment discovery across multiple protocols"""
    
    # Network discovery for OPC-UA servers
    opc_discovery = await iot_client.discover_opc_servers(
        network_range="192.168.1.0/24",
        timeout_seconds=30
    )
    
    # Modbus device scanning
    modbus_discovery = await iot_client.discover_modbus_devices(
        network_range="192.168.1.0/24",
        port_range=[502, 1502, 2502]
    )
    
    # MQTT broker discovery
    mqtt_discovery = await iot_client.discover_mqtt_brokers(
        network_range="192.168.1.0/24"
    )
    
    discovered_equipment = []
    
    # Process OPC-UA discoveries
    for server in opc_discovery.servers:
        equipment_config = {
            "equipment_id": f"opc_{server.endpoint.split('/')[-1]}",
            "equipment_type": await classify_equipment_type(server),
            "protocol": "opc_ua",
            "connection_config": {
                "endpoint": server.endpoint,
                "security_policy": server.security_policy,
                "authentication": determine_auth_method(server)
            },
            "sensors": await discover_opc_sensors(server)
        }
        
        # Register in equipment database
        registration = await equipment_registry.register_equipment(equipment_config)
        discovered_equipment.append(registration)
    
    # Process Modbus discoveries
    for device in modbus_discovery.devices:
        equipment_config = {
            "equipment_id": f"modbus_{device.ip}_{device.slave_id}",
            "equipment_type": await classify_modbus_equipment(device),
            "protocol": "modbus_tcp",
            "connection_config": {
                "host": device.ip,
                "port": device.port,
                "slave_id": device.slave_id
            },
            "sensors": await map_modbus_registers(device)
        }
        
        registration = await equipment_registry.register_equipment(equipment_config)
        discovered_equipment.append(registration)
    
    return discovered_equipment

async def establish_connections(equipment_list):
    """Establish reliable connections with error handling and reconnection"""
    
    connections = {}
    
    for equipment in equipment_list:
        try:
            if equipment.protocol == "opc_ua":
                connection = await setup_opc_connection(equipment)
            elif equipment.protocol == "modbus_tcp":
                connection = await setup_modbus_connection(equipment)
            elif equipment.protocol == "mqtt":
                connection = await setup_mqtt_connection(equipment)
            elif equipment.protocol == "ethernet_ip":
                connection = await setup_ethernet_ip_connection(equipment)
            
            # Configure connection resilience
            connection.configure_resilience({
                "reconnect_attempts": 5,
                "reconnect_delay": 30,
                "heartbeat_interval": 60,
                "timeout": 30,
                "circuit_breaker": {
                    "failure_threshold": 5,
                    "recovery_timeout": 300
                }
            })
            
            connections[equipment.equipment_id] = connection
            
        except Exception as e:
            print(f"Failed to connect to {equipment.equipment_id}: {e}")
            # Log to monitoring system
            await log_connection_failure(equipment.equipment_id, str(e))
    
    return connections

# Equipment type classification using ML
async def classify_equipment_type(server_info):
    """Use ML to classify equipment type from OPC-UA node structure"""
    
    node_structure = await iot_client.analyze_opc_node_structure(server_info.endpoint)
    
    classification = await iot_client.classify_equipment({
        "node_count": len(node_structure.nodes),
        "namespace_patterns": node_structure.namespace_patterns,
        "data_type_distribution": node_structure.data_types,
        "update_rates": node_structure.update_rates
    })
    
    return classification.equipment_type

# Start equipment discovery and connection
discovered_equipment = await discover_and_configure_equipment()
active_connections = await establish_connections(discovered_equipment)

print(f"Successfully connected to {len(active_connections)} devices")`}
                  language="python"
                />
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">2. Real-time Data Streaming Architecture</h4>
                <CodeBlock
                  code={`# High-performance data streaming with quality assurance
from schlep_engine import DataStreaming, DataQuality
import asyncio
from datetime import datetime

class ManufacturingDataStreamer:
    def __init__(self, api_key):
        self.streaming = DataStreaming(api_key=api_key)
        self.quality = DataQuality(api_key=api_key)
        self.connections = {}
        self.data_buffer = {}
        self.quality_checks = {}
        
    async def start_unified_streaming(self, connections):
        """Start unified data streaming from all equipment"""
        
        # Create data streams for each connection
        stream_configs = []
        
        for equipment_id, connection in connections.items():
            stream_config = {
                "equipment_id": equipment_id,
                "sampling_rate": await self.determine_optimal_sampling_rate(equipment_id),
                "data_processing": {
                    "real_time_validation": True,
                    "outlier_detection": True,
                    "data_enrichment": True,
                    "time_synchronization": True
                },
                "quality_gates": {
                    "missing_value_threshold": 0.05,
                    "outlier_threshold": 3.0,
                    "latency_threshold_ms": 1000
                }
            }
            stream_configs.append(stream_config)
        
        # Start streaming with fault tolerance
        streaming_tasks = []
        
        for config in stream_configs:
            task = asyncio.create_task(
                self.stream_equipment_data(config)
            )
            streaming_tasks.append(task)
        
        # Unified data processing pipeline
        processing_task = asyncio.create_task(
            self.unified_data_processing()
        )
        
        streaming_tasks.append(processing_task)
        
        # Wait for all streams
        await asyncio.gather(*streaming_tasks)
    
    async def stream_equipment_data(self, config):
        """Stream data from individual equipment with quality checks"""
        
        equipment_id = config["equipment_id"]
        connection = self.connections[equipment_id]
        
        while True:
            try:
                # Read sensor data
                raw_data = await connection.read_all_sensors()
                
                # Apply quality checks
                quality_result = await self.quality.validate_realtime(
                    data=raw_data,
                    equipment_id=equipment_id,
                    quality_config=config["quality_gates"]
                )
                
                if quality_result.passed:
                    # Enrich data with context
                    enriched_data = await self.enrich_sensor_data(
                        raw_data, equipment_id
                    )
                    
                    # Add to unified stream
                    await self.add_to_unified_stream(enriched_data)
                    
                else:
                    # Handle quality failures
                    await self.handle_quality_failure(
                        equipment_id, quality_result
                    )
                
                # Dynamic sampling rate adjustment
                await asyncio.sleep(
                    await self.get_adaptive_sampling_interval(equipment_id)
                )
                
            except Exception as e:
                await self.handle_streaming_error(equipment_id, e)
                await asyncio.sleep(5)  # Back-off before retry
    
    async def unified_data_processing(self):
        """Unified processing pipeline for all equipment data"""
        
        while True:
            try:
                # Process buffered data
                batch_data = await self.get_processing_batch()
                
                if batch_data:
                    # Parallel processing tasks
                    processing_tasks = [
                        self.real_time_analytics(batch_data),
                        self.anomaly_detection(batch_data),
                        self.predictive_maintenance_analysis(batch_data),
                        self.quality_trend_analysis(batch_data),
                        self.energy_optimization_analysis(batch_data)
                    ]
                    
                    results = await asyncio.gather(*processing_tasks)
                    
                    # Consolidate and route results
                    await self.route_analysis_results(results)
                
                await asyncio.sleep(1)  # Process every second
                
            except Exception as e:
                print(f"Error in unified processing: {e}")
                await asyncio.sleep(5)
    
    async def enrich_sensor_data(self, raw_data, equipment_id):
        """Enrich sensor data with contextual information"""
        
        equipment_info = await self.equipment_registry.get_equipment_info(equipment_id)
        
        enriched_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "equipment_id": equipment_id,
            "equipment_type": equipment_info.equipment_type,
            "location": equipment_info.location,
            "shift": await self.get_current_shift(),
            "production_context": await self.get_production_context(equipment_id),
            "sensor_data": raw_data,
            "data_quality": {
                "completeness": await self.calculate_completeness(raw_data),
                "accuracy_score": await self.calculate_accuracy_score(raw_data),
                "timeliness_score": await self.calculate_timeliness_score()
            }
        }
        
        return enriched_data
    
    async def determine_optimal_sampling_rate(self, equipment_id):
        """AI-driven sampling rate optimization"""
        
        equipment_profile = await self.equipment_registry.get_profile(equipment_id)
        historical_patterns = await self.analyze_historical_patterns(equipment_id)
        
        optimal_rate = await self.streaming.optimize_sampling_rate({
            "equipment_type": equipment_profile.equipment_type,
            "criticality": equipment_profile.criticality,
            "variability_patterns": historical_patterns.variability,
            "downstream_requirements": equipment_profile.analytics_requirements,
            "network_constraints": await self.assess_network_capacity()
        })
        
        return optimal_rate.sampling_interval_ms

# Initialize and start streaming
streamer = ManufacturingDataStreamer(api_key="your_api_key")
streamer.connections = active_connections

await streamer.start_unified_streaming(active_connections)`}
                  language="python"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Phase 2: Analytics & Predictive Maintenance */}
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Phase 2: Advanced Analytics & Predictive Maintenance</h2>
        
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <ChartBarIcon className="h-5 w-5 text-blue-600 mr-2" />
              Intelligent Predictive Maintenance System
            </h3>
            
            <CodeBlock
              code={`# Advanced predictive maintenance with multi-modal analysis
from schlep_engine import PredictiveMaintenance, AnalyticsEngine, DigitalTwin

class IntelligentMaintenanceSystem:
    def __init__(self, api_key):
        self.predictive = PredictiveMaintenance(api_key=api_key)
        self.analytics = AnalyticsEngine(api_key=api_key)
        self.digital_twin = DigitalTwin(api_key=api_key)
        
        # ML models for different failure modes
        self.failure_models = {}
        self.health_models = {}
        self.remaining_life_models = {}
        
    async def initialize_maintenance_system(self, equipment_list):
        """Initialize comprehensive maintenance system"""
        
        maintenance_configs = []
        
        for equipment in equipment_list:
            # Create equipment-specific maintenance configuration
            config = await self.create_maintenance_config(equipment)
            maintenance_configs.append(config)
            
            # Initialize ML models for this equipment
            await self.initialize_equipment_models(equipment)
            
            # Set up digital twin for physics-based analysis
            await self.setup_digital_twin(equipment)
        
        # Create unified maintenance dashboard
        self.maintenance_dashboard = await self.predictive.create_dashboard(
            configurations=maintenance_configs
        )
        
        return maintenance_configs
    
    async def create_maintenance_config(self, equipment):
        """Create comprehensive maintenance configuration"""
        
        equipment_profile = await self.analyze_equipment_profile(equipment)
        
        config = {
            "equipment_id": equipment.equipment_id,
            "maintenance_strategy": {
                "primary_approach": "predictive",
                "fallback_approach": "condition_based",
                "failure_modes": equipment_profile.failure_modes,
                "critical_components": equipment_profile.critical_components
            },
            "analysis_methods": {
                "vibration_analysis": {
                    "enabled": "vibration" in equipment.sensor_types,
                    "frequency_ranges": equipment_profile.vibration_frequencies,
                    "analysis_techniques": ["fft", "envelope", "cepstrum"]
                },
                "thermal_analysis": {
                    "enabled": "temperature" in equipment.sensor_types,
                    "baseline_temps": equipment_profile.baseline_temperatures,
                    "thermal_zones": equipment_profile.thermal_zones
                },
                "lubrication_analysis": {
                    "enabled": "oil_analysis" in equipment.capabilities,
                    "oil_change_intervals": equipment_profile.oil_intervals,
                    "contamination_thresholds": equipment_profile.contamination_limits
                },
                "electrical_analysis": {
                    "enabled": "electrical" in equipment.sensor_types,
                    "current_signature": True,
                    "power_quality": True
                }
            },
            "ml_models": {
                "failure_prediction": {
                    "model_type": "lstm_ensemble",
                    "prediction_horizon": "30d",
                    "confidence_threshold": 0.8
                },
                "anomaly_detection": {
                    "model_type": "isolation_forest",
                    "sensitivity": "high",
                    "feature_importance": True
                },
                "remaining_useful_life": {
                    "model_type": "survival_analysis",
                    "uncertainty_quantification": True
                }
            },
            "maintenance_optimization": {
                "cost_model": equipment_profile.cost_structure,
                "availability_requirements": equipment_profile.availability_sla,
                "maintenance_windows": equipment_profile.maintenance_schedule
            }
        }
        
        return config
    
    async def execute_predictive_analysis(self, equipment_id, sensor_data):
        """Execute comprehensive predictive maintenance analysis"""
        
        analysis_results = {}
        
        # Multi-modal feature extraction
        features = await self.extract_comprehensive_features(equipment_id, sensor_data)
        
        # Failure mode predictions
        failure_predictions = await self.predict_failure_modes(equipment_id, features)
        analysis_results["failure_predictions"] = failure_predictions
        
        # Anomaly detection
        anomaly_results = await self.detect_anomalies(equipment_id, features)
        analysis_results["anomalies"] = anomaly_results
        
        # Remaining useful life estimation
        rul_prediction = await self.estimate_remaining_life(equipment_id, features)
        analysis_results["remaining_life"] = rul_prediction
        
        # Digital twin validation
        if equipment_id in self.digital_twins:
            twin_analysis = await self.validate_with_digital_twin(
                equipment_id, sensor_data, analysis_results
            )
            analysis_results["physics_validation"] = twin_analysis
        
        # Maintenance optimization
        maintenance_plan = await self.optimize_maintenance_schedule(
            equipment_id, analysis_results
        )
        analysis_results["maintenance_plan"] = maintenance_plan
        
        return analysis_results
    
    async def extract_comprehensive_features(self, equipment_id, sensor_data):
        """Extract multi-domain features for analysis"""
        
        features = {}
        
        # Time domain features
        features["time_domain"] = await self.analytics.extract_time_features(
            data=sensor_data,
            features=["mean", "std", "rms", "peak", "kurtosis", "skewness"]
        )
        
        # Frequency domain features  
        features["frequency_domain"] = await self.analytics.extract_frequency_features(
            data=sensor_data,
            methods=["fft", "welch", "periodogram"],
            frequency_bands=await self.get_equipment_frequency_bands(equipment_id)
        )
        
        # Wavelet domain features
        features["wavelet_domain"] = await self.analytics.extract_wavelet_features(
            data=sensor_data,
            wavelet_types=["db4", "haar", "coif2"]
        )
        
        # Statistical features
        features["statistical"] = await self.analytics.extract_statistical_features(
            data=sensor_data,
            include_distribution_tests=True
        )
        
        # Cross-sensor correlation features
        features["correlation"] = await self.analytics.extract_correlation_features(
            data=sensor_data,
            methods=["pearson", "spearman", "mutual_info"]
        )
        
        # Operational context features
        features["operational"] = await self.extract_operational_features(
            equipment_id, sensor_data.timestamp
        )
        
        return features
    
    async def predict_failure_modes(self, equipment_id, features):
        """Predict specific failure modes with confidence intervals"""
        
        equipment_config = self.maintenance_configs[equipment_id]
        failure_modes = equipment_config["maintenance_strategy"]["failure_modes"]
        
        predictions = {}
        
        for failure_mode in failure_modes:
            model_key = f"{equipment_id}_{failure_mode}"
            
            if model_key in self.failure_models:
                # Get prediction with uncertainty
                prediction = await self.failure_models[model_key].predict(
                    features=features,
                    return_uncertainty=True
                )
                
                predictions[failure_mode] = {
                    "probability": prediction.probability,
                    "confidence_interval": prediction.confidence_interval,
                    "time_to_failure": prediction.time_to_failure,
                    "contributing_factors": prediction.feature_importance,
                    "recommendation": await self.generate_recommendation(
                        failure_mode, prediction
                    )
                }
        
        return predictions
    
    async def optimize_maintenance_schedule(self, equipment_id, analysis_results):
        """Optimize maintenance schedule based on predictions and constraints"""
        
        optimization_config = {
            "equipment_id": equipment_id,
            "current_predictions": analysis_results,
            "constraints": {
                "production_schedule": await self.get_production_schedule(equipment_id),
                "maintenance_resources": await self.get_available_resources(),
                "cost_constraints": await self.get_cost_constraints(equipment_id)
            },
            "objectives": [
                {"name": "minimize_cost", "weight": 0.3},
                {"name": "maximize_availability", "weight": 0.4},
                {"name": "minimize_risk", "weight": 0.3}
            ]
        }
        
        # Multi-objective optimization
        optimal_schedule = await self.predictive.optimize_schedule(optimization_config)
        
        # Validate schedule feasibility
        feasibility_check = await self.validate_schedule_feasibility(
            equipment_id, optimal_schedule
        )
        
        if not feasibility_check.feasible:
            # Generate alternative schedules
            alternatives = await self.generate_alternative_schedules(
                equipment_id, optimization_config, feasibility_check.constraints
            )
            optimal_schedule = alternatives[0]  # Best alternative
        
        return {
            "recommended_schedule": optimal_schedule,
            "cost_benefit_analysis": await self.calculate_cost_benefit(
                equipment_id, optimal_schedule
            ),
            "risk_assessment": await self.assess_schedule_risk(
                equipment_id, optimal_schedule
            )
        }

# Initialize intelligent maintenance system
maintenance_system = IntelligentMaintenanceSystem(api_key="your_api_key")
await maintenance_system.initialize_maintenance_system(discovered_equipment)

# Continuous monitoring loop
async def continuous_maintenance_monitoring():
    while True:
        for equipment_id in active_connections:
            try:
                # Get latest sensor data
                sensor_data = await streamer.get_latest_data(equipment_id)
                
                # Run predictive analysis
                analysis = await maintenance_system.execute_predictive_analysis(
                    equipment_id, sensor_data
                )
                
                # Check for critical alerts
                if analysis["failure_predictions"]:
                    for failure_mode, prediction in analysis["failure_predictions"].items():
                        if prediction["probability"] > 0.8:
                            await trigger_critical_maintenance_alert(
                                equipment_id, failure_mode, prediction
                            )
                
                # Update maintenance dashboard
                await maintenance_system.update_dashboard(equipment_id, analysis)
                
            except Exception as e:
                print(f"Error in maintenance analysis for {equipment_id}: {e}")
        
        await asyncio.sleep(300)  # Run every 5 minutes

# Start continuous monitoring
await continuous_maintenance_monitoring()`}
              language="python"
            />
          </div>
        </div>
      </section>

      {/* Phase 3: Quality Control & SPC */}
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Phase 3: Advanced Quality Control & SPC</h2>
        
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <CheckCircleIcon className="h-5 w-5 text-green-600 mr-2" />
            Intelligent Statistical Process Control
          </h3>
          
          <CodeBlock
            code={`# Advanced SPC with AI-powered process optimization
from schlep_engine import StatisticalProcessControl, QualityAnalytics, ProcessOptimization

class IntelligentQualitySystem:
    def __init__(self, api_key):
        self.spc = StatisticalProcessControl(api_key=api_key)
        self.quality = QualityAnalytics(api_key=api_key)
        self.optimizer = ProcessOptimization(api_key=api_key)
        
        self.spc_controllers = {}
        self.quality_models = {}
        self.process_models = {}
    
    async def initialize_quality_system(self, production_lines):
        """Initialize comprehensive quality control system"""
        
        for line in production_lines:
            # Set up SPC for each quality parameter
            await self.setup_line_spc(line)
            
            # Initialize quality prediction models
            await self.initialize_quality_models(line)
            
            # Set up process capability monitoring
            await self.setup_capability_monitoring(line)
        
        # Create unified quality dashboard
        self.quality_dashboard = await self.quality.create_dashboard(
            production_lines=[line.line_id for line in production_lines]
        )
    
    async def setup_line_spc(self, production_line):
        """Set up comprehensive SPC for production line"""
        
        # Analyze historical data to determine optimal control limits
        historical_analysis = await self.quality.analyze_historical_quality(
            line_id=production_line.line_id,
            time_period="6m",  # 6 months of data
            parameters=production_line.quality_parameters
        )
        
        spc_configs = []
        
        for parameter in production_line.quality_parameters:
            # Dynamic control limit calculation
            control_limits = await self.calculate_adaptive_limits(
                parameter, historical_analysis
            )
            
            spc_config = {
                "process_id": f"{production_line.line_id}_{parameter.name}",
                "parameter_name": parameter.name,
                "chart_type": await self.select_optimal_chart_type(parameter),
                "control_limits": control_limits,
                "sample_size": await self.optimize_sample_size(parameter),
                "sampling_frequency": await self.optimize_sampling_frequency(parameter),
                "violation_rules": [
                    "point_beyond_limits",
                    "seven_consecutive_one_side",
                    "two_of_three_beyond_2sigma",
                    "four_of_five_beyond_1sigma",
                    "eight_consecutive_within_1sigma",  # Stratification
                    "fifteen_consecutive_within_1sigma"  # Mixture
                ],
                "adaptive_limits": {
                    "enabled": True,
                    "recalculation_frequency": "weekly",
                    "minimum_samples": 100
                },
                "autocorrelation_handling": {
                    "enabled": True,
                    "method": "ewma_residuals"
                }
            }
            
            spc_controller = await self.spc.create_controller(spc_config)
            self.spc_controllers[spc_config["process_id"]] = spc_controller
            
            spc_configs.append(spc_config)
        
        return spc_configs
    
    async def process_quality_measurement(self, measurement):
        """Process quality measurement through comprehensive SPC analysis"""
        
        process_id = f"{measurement.line_id}_{measurement.parameter_name}"
        
        if process_id not in self.spc_controllers:
            print(f"No SPC controller found for {process_id}")
            return
        
        spc_controller = self.spc_controllers[process_id]
        
        # Add measurement to SPC chart
        spc_result = await spc_controller.add_measurement(
            value=measurement.value,
            timestamp=measurement.timestamp,
            sample_info=measurement.sample_info
        )
        
        # Check for violations
        violations = await self.check_comprehensive_violations(
            process_id, spc_result
        )
        
        if violations:
            await self.handle_spc_violations(process_id, violations, measurement)
        
        # Update process capability indices
        await self.update_process_capability(process_id, measurement)
        
        # Predictive quality analysis
        quality_prediction = await self.predict_quality_trend(
            process_id, measurement
        )
        
        if quality_prediction.trend_alert:
            await self.handle_quality_trend_alert(process_id, quality_prediction)
        
        # Process optimization recommendations
        if spc_result.samples_count % 50 == 0:  # Every 50 samples
            optimization = await self.generate_process_optimization(process_id)
            if optimization.has_recommendations:
                await self.apply_process_optimization(process_id, optimization)
        
        return {
            "spc_result": spc_result,
            "violations": violations,
            "capability": await self.get_current_capability(process_id),
            "prediction": quality_prediction,
            "recommendations": await self.get_process_recommendations(process_id)
        }
    
    async def check_comprehensive_violations(self, process_id, spc_result):
        """Check for all types of SPC violations including advanced patterns"""
        
        violations = []
        data_points = spc_result.recent_points
        control_limits = spc_result.control_limits
        
        # Standard Western Electric Rules
        violations.extend(await self.check_western_electric_rules(data_points, control_limits))
        
        # Advanced pattern detection
        violations.extend(await self.detect_advanced_patterns(data_points))
        
        # Trend analysis
        violations.extend(await self.detect_trend_violations(data_points))
        
        # Seasonal pattern violations
        violations.extend(await self.detect_seasonal_violations(process_id, data_points))
        
        # Multivariate violations (if applicable)
        violations.extend(await self.detect_multivariate_violations(process_id, data_points))
        
        return violations
    
    async def detect_advanced_patterns(self, data_points):
        """Detect advanced SPC patterns using AI"""
        
        pattern_detector = await self.spc.get_pattern_detector()
        
        patterns = await pattern_detector.detect_patterns(
            data=data_points,
            pattern_types=[
                "systematic_variation",
                "freaks", 
                "grouping_bunching",
                "mixture",
                "stratification",
                "interaction",
                "instability"
            ]
        )
        
        violations = []
        
        for pattern in patterns:
            if pattern.confidence > 0.8:
                violations.append({
                    "type": f"pattern_{pattern.pattern_type}",
                    "severity": pattern.severity,
                    "description": pattern.description,
                    "confidence": pattern.confidence,
                    "affected_points": pattern.point_indices,
                    "recommendation": pattern.recommendation
                })
        
        return violations
    
    async def handle_spc_violations(self, process_id, violations, measurement):
        """Intelligent violation handling with automated responses"""
        
        for violation in violations:
            # Classify violation severity
            severity = await self.classify_violation_severity(violation, process_id)
            
            if severity == "critical":
                # Immediate process intervention
                await self.trigger_immediate_intervention(process_id, violation)
                
            elif severity == "major":
                # Schedule urgent investigation
                await self.schedule_process_investigation(process_id, violation)
                
            elif severity == "minor":
                # Log for trending analysis
                await self.log_minor_violation(process_id, violation)
            
            # Generate corrective action recommendations
            recommendations = await self.generate_corrective_actions(
                process_id, violation, measurement
            )
            
            # Create work order for corrective action
            if recommendations.requires_action:
                await self.create_corrective_action_order(
                    process_id, violation, recommendations
                )
            
            # Update quality dashboard
            await self.update_quality_dashboard(process_id, violation)
    
    async def generate_process_optimization(self, process_id):
        """Generate AI-powered process optimization recommendations"""
        
        # Analyze process performance
        performance_analysis = await self.quality.analyze_process_performance(
            process_id=process_id,
            time_window="30d"
        )
        
        # Identify optimization opportunities
        opportunities = await self.optimizer.identify_opportunities(
            process_data=performance_analysis,
            optimization_objectives=[
                "minimize_variation",
                "improve_capability", 
                "reduce_defects",
                "optimize_cost"
            ]
        )
        
        # Generate specific recommendations
        recommendations = []
        
        for opportunity in opportunities:
            if opportunity.potential_improvement > 0.05:  # 5% improvement threshold
                recommendation = await self.optimizer.generate_recommendation(
                    opportunity=opportunity,
                    constraints=await self.get_process_constraints(process_id),
                    business_impact=await self.calculate_business_impact(opportunity)
                )
                
                recommendations.append(recommendation)
        
        return {
            "has_recommendations": len(recommendations) > 0,
            "recommendations": recommendations,
            "potential_savings": sum(r.business_impact.cost_savings for r in recommendations),
            "implementation_complexity": await self.assess_implementation_complexity(recommendations)
        }
    
    async def apply_process_optimization(self, process_id, optimization):
        """Apply process optimization recommendations"""
        
        for recommendation in optimization.recommendations:
            if recommendation.auto_applicable and recommendation.risk_level == "low":
                # Automatically apply low-risk optimizations
                await self.auto_apply_optimization(process_id, recommendation)
                
            else:
                # Create approval workflow for higher-risk changes
                await self.create_optimization_approval_workflow(
                    process_id, recommendation
                )
        
        # Monitor optimization impact
        await self.monitor_optimization_impact(process_id, optimization)

# Initialize quality system
quality_system = IntelligentQualitySystem(api_key="your_api_key")

# Integrate with production lines
production_lines = await get_production_line_configs()
await quality_system.initialize_quality_system(production_lines)

# Real-time quality monitoring
async def real_time_quality_monitoring():
    """Continuous quality monitoring and control"""
    
    quality_stream = await quality_system.create_quality_stream()
    
    async for measurement in quality_stream:
        try:
            # Process through intelligent SPC
            result = await quality_system.process_quality_measurement(measurement)
            
            # Real-time quality predictions
            if result["prediction"].requires_attention:
                await handle_quality_prediction_alert(measurement, result["prediction"])
            
            # Dashboard updates
            await quality_system.update_real_time_dashboard(measurement, result)
            
        except Exception as e:
            print(f"Error in quality monitoring: {e}")

# Start quality monitoring
await real_time_quality_monitoring()`}
            language="python"
          />
        </div>
      </section>

      {/* Phase 4: Smart Factory Integration */}
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Phase 4: Smart Factory Integration & Optimization</h2>
        
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <CogIcon className="h-5 w-5 text-purple-600 mr-2" />
            Digital Twin Factory Orchestration
          </h3>
          
          <CodeBlock
            code={`# Complete smart factory orchestration with digital twins
from schlep_engine import SmartFactory, DigitalTwinOrchestrator, ProductionOptimizer

class SmartFactoryOrchestrator:
    def __init__(self, api_key):
        self.factory = SmartFactory(api_key=api_key)
        self.twin_orchestrator = DigitalTwinOrchestrator(api_key=api_key)
        self.optimizer = ProductionOptimizer(api_key=api_key)
        
        self.digital_twins = {}
        self.production_models = {}
        self.optimization_engines = {}
    
    async def initialize_smart_factory(self, factory_config):
        """Initialize complete smart factory system"""
        
        # Create digital twins for all critical equipment
        for equipment in factory_config.critical_equipment:
            twin_id = await self.create_equipment_digital_twin(equipment)
            self.digital_twins[equipment.equipment_id] = twin_id
        
        # Set up production line digital twins
        for line in factory_config.production_lines:
            line_twin = await self.create_production_line_twin(line)
            self.digital_twins[line.line_id] = line_twin
        
        # Create factory-wide digital twin
        factory_twin = await self.create_factory_twin(factory_config)
        self.digital_twins["factory"] = factory_twin
        
        # Initialize production optimization engines
        await self.initialize_optimization_engines(factory_config)
        
        # Set up factory orchestration
        await self.setup_factory_orchestration()
        
        return self.digital_twins
    
    async def create_equipment_digital_twin(self, equipment):
        """Create high-fidelity equipment digital twin"""
        
        twin_config = {
            "asset_details": {
                "asset_id": equipment.equipment_id,
                "asset_type": equipment.equipment_type,
                "manufacturer": equipment.manufacturer,
                "model": equipment.model,
                "specifications": equipment.specifications
            },
            "physics_model": {
                "fidelity": "high",
                "model_type": "multi_physics",
                "thermal_model": equipment.supports_thermal_modeling,
                "mechanical_model": equipment.supports_mechanical_modeling,
                "electrical_model": equipment.supports_electrical_modeling,
                "fluid_dynamics": equipment.supports_fluid_modeling
            },
            "digital_twin_config": {
                "update_frequency": "real_time",
                "prediction_horizon": "7d",
                "simulation_modes": ["operational", "maintenance", "optimization"],
                "integration_apis": equipment.integration_capabilities
            },
            "ml_integration": {
                "predictive_maintenance": True,
                "anomaly_detection": True,
                "performance_optimization": True,
                "quality_prediction": True
            }
        }
        
        twin = await self.twin_orchestrator.create_twin(twin_config)
        
        # Calibrate with historical data
        await self.calibrate_twin_with_history(twin.twin_id, equipment.equipment_id)
        
        # Set up real-time synchronization
        await self.setup_real_time_sync(twin.twin_id, equipment.equipment_id)
        
        return twin.twin_id
    
    async def create_production_line_twin(self, production_line):
        """Create production line digital twin with workflow modeling"""
        
        line_twin_config = {
            "line_id": production_line.line_id,
            "equipment_twins": [
                self.digital_twins[eq.equipment_id] 
                for eq in production_line.equipment
            ],
            "process_flow": {
                "workflow_model": production_line.workflow_definition,
                "material_flow": production_line.material_flow,
                "information_flow": production_line.information_flow,
                "energy_flow": production_line.energy_flow
            },
            "performance_models": {
                "throughput_model": "discrete_event_simulation",
                "quality_propagation": "bayesian_network",
                "bottleneck_analysis": "constraint_theory",
                "buffer_optimization": "queuing_theory"
            },
            "optimization_objectives": [
                "maximize_oee",
                "minimize_cycle_time", 
                "optimize_quality",
                "reduce_energy_consumption"
            ]
        }
        
        line_twin = await self.twin_orchestrator.create_line_twin(line_twin_config)
        
        # Integrate with MES
        await self.integrate_line_twin_with_mes(line_twin.twin_id, production_line)
        
        return line_twin.twin_id
    
    async def execute_factory_optimization(self):
        """Execute comprehensive factory optimization"""
        
        while True:
            try:
                # Collect current state from all twins
                factory_state = await self.collect_factory_state()
                
                # Run multi-objective optimization
                optimization_results = await self.run_factory_optimization(factory_state)
                
                # Validate optimization with digital twins
                validation_results = await self.validate_optimization_with_twins(
                    optimization_results
                )
                
                if validation_results.feasible:
                    # Apply optimizations gradually
                    await self.apply_gradual_optimization(optimization_results)
                    
                    # Monitor optimization impact
                    await self.monitor_optimization_impact()
                
                # Advanced scenario planning
                await self.execute_scenario_planning()
                
                # Predictive factory analytics
                await self.execute_predictive_analytics()
                
                await asyncio.sleep(300)  # Optimize every 5 minutes
                
            except Exception as e:
                print(f"Error in factory optimization: {e}")
                await asyncio.sleep(60)
    
    async def run_factory_optimization(self, factory_state):
        """Multi-objective factory optimization"""
        
        optimization_config = {
            "current_state": factory_state,
            "objectives": [
                {
                    "name": "maximize_overall_oee",
                    "weight": 0.25,
                    "constraints": {"min_oee": 0.75}
                },
                {
                    "name": "minimize_energy_consumption",
                    "weight": 0.20,
                    "constraints": {"max_increase": 0.05}
                },
                {
                    "name": "optimize_quality",
                    "weight": 0.25,
                    "constraints": {"min_yield": 0.95}
                },
                {
                    "name": "minimize_production_cost",
                    "weight": 0.30,
                    "constraints": {"max_increase": 0.03}
                }
            ],
            "optimization_horizon": "24h",
            "constraints": {
                "production_targets": await self.get_production_targets(),
                "resource_availability": await self.get_resource_constraints(),
                "maintenance_windows": await self.get_maintenance_schedule(),
                "quality_requirements": await self.get_quality_constraints()
            },
            "optimization_methods": [
                "genetic_algorithm",
                "particle_swarm",
                "simulated_annealing",
                "reinforcement_learning"
            ]
        }
        
        # Multi-method optimization with ensemble results
        optimization_results = await self.optimizer.optimize_factory(optimization_config)
        
        # Validate results with digital twins
        twin_validation = await self.validate_with_factory_twin(optimization_results)
        
        return {
            "optimization_results": optimization_results,
            "twin_validation": twin_validation,
            "implementation_plan": await self.create_implementation_plan(optimization_results),
            "risk_assessment": await self.assess_optimization_risks(optimization_results)
        }
    
    async def execute_scenario_planning(self):
        """Execute comprehensive scenario planning"""
        
        scenarios = [
            {
                "name": "demand_surge_20_percent",
                "description": "20% increase in production demand",
                "parameters": {"demand_multiplier": 1.2}
            },
            {
                "name": "supply_chain_disruption",
                "description": "Key supplier delayed by 48 hours", 
                "parameters": {"supply_delay_hours": 48}
            },
            {
                "name": "equipment_failure",
                "description": "Critical equipment failure scenario",
                "parameters": {"failed_equipment": "most_critical"}
            },
            {
                "name": "quality_issue",
                "description": "Quality problem requiring rework",
                "parameters": {"rework_rate": 0.15}
            },
            {
                "name": "energy_price_spike",
                "description": "50% increase in energy costs",
                "parameters": {"energy_cost_multiplier": 1.5}
            }
        ]
        
        scenario_results = []
        
        for scenario in scenarios:
            # Run scenario on factory digital twin
            scenario_result = await self.twin_orchestrator.run_scenario(
                twin_id=self.digital_twins["factory"],
                scenario_config=scenario,
                simulation_duration="7d",
                simulation_speed=100  # 100x real-time
            )
            
            # Analyze scenario impact
            impact_analysis = await self.analyze_scenario_impact(scenario_result)
            
            # Generate contingency plans
            contingency_plans = await self.generate_contingency_plans(
                scenario, impact_analysis
            )
            
            scenario_results.append({
                "scenario": scenario,
                "results": scenario_result,
                "impact": impact_analysis,
                "contingency_plans": contingency_plans
            })
        
        # Update factory resilience planning
        await self.update_resilience_planning(scenario_results)
        
        return scenario_results

# Initialize smart factory orchestrator
factory_orchestrator = SmartFactoryOrchestrator(api_key="your_api_key")

# Load factory configuration
factory_config = await load_factory_configuration()

# Initialize smart factory
digital_twins = await factory_orchestrator.initialize_smart_factory(factory_config)

print(f"Smart factory initialized with {len(digital_twins)} digital twins")

# Start factory orchestration
await factory_orchestrator.execute_factory_optimization()`}
            language="python"
          />
        </div>
      </section>

      {/* Best Practices Summary */}
      <section className="bg-gray-50 rounded-xl p-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Manufacturing Workflow Best Practices</h2>
        
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">✅ Essential Practices</h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <CheckCircleIcon className="h-4 w-4 text-green-600 mt-0.5 mr-2 flex-shrink-0" />
                Implement multi-protocol IoT integration for equipment diversity
              </li>
              <li className="flex items-start">
                <CheckCircleIcon className="h-4 w-4 text-green-600 mt-0.5 mr-2 flex-shrink-0" />
                Use AI-powered predictive maintenance with multiple failure modes
              </li>
              <li className="flex items-start">
                <CheckCircleIcon className="h-4 w-4 text-green-600 mt-0.5 mr-2 flex-shrink-0" />
                Deploy comprehensive SPC with advanced pattern detection
              </li>
              <li className="flex items-start">
                <CheckCircleIcon className="h-4 w-4 text-green-600 mt-0.5 mr-2 flex-shrink-0" />
                Create high-fidelity digital twins for critical equipment
              </li>
              <li className="flex items-start">
                <CheckCircleIcon className="h-4 w-4 text-green-600 mt-0.5 mr-2 flex-shrink-0" />
                Integrate MES with real-time production optimization
              </li>
              <li className="flex items-start">
                <CheckCircleIcon className="h-4 w-4 text-green-600 mt-0.5 mr-2 flex-shrink-0" />
                Implement adaptive sampling and intelligent data quality gates
              </li>
              <li className="flex items-start">
                <CheckCircleIcon className="h-4 w-4 text-green-600 mt-0.5 mr-2 flex-shrink-0" />
                Use multi-objective optimization for factory-wide efficiency
              </li>
              <li className="flex items-start">
                <CheckCircleIcon className="h-4 w-4 text-green-600 mt-0.5 mr-2 flex-shrink-0" />
                Execute regular scenario planning for resilience
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">⚠️ Critical Considerations</h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <ExclamationTriangleIcon className="h-4 w-4 text-orange-600 mt-0.5 mr-2 flex-shrink-0" />
                Ensure cybersecurity for all IoT connections and protocols
              </li>
              <li className="flex items-start">
                <ExclamationTriangleIcon className="h-4 w-4 text-orange-600 mt-0.5 mr-2 flex-shrink-0" />
                Validate all AI predictions with physics-based models
              </li>
              <li className="flex items-start">
                <ExclamationTriangleIcon className="h-4 w-4 text-orange-600 mt-0.5 mr-2 flex-shrink-0" />
                Maintain human oversight for critical production decisions
              </li>
              <li className="flex items-start">
                <ExclamationTriangleIcon className="h-4 w-4 text-orange-600 mt-0.5 mr-2 flex-shrink-0" />
                Plan for network failures and system redundancy
              </li>
              <li className="flex items-start">
                <ExclamationTriangleIcon className="h-4 w-4 text-orange-600 mt-0.5 mr-2 flex-shrink-0" />
                Implement gradual rollout for optimization changes
              </li>
              <li className="flex items-start">
                <ExclamationTriangleIcon className="h-4 w-4 text-orange-600 mt-0.5 mr-2 flex-shrink-0" />
                Monitor data quality continuously across all sensors
              </li>
              <li className="flex items-start">
                <ExclamationTriangleIcon className="h-4 w-4 text-orange-600 mt-0.5 mr-2 flex-shrink-0" />
                Maintain proper documentation for regulatory compliance
              </li>
              <li className="flex items-start">
                <ExclamationTriangleIcon className="h-4 w-4 text-orange-600 mt-0.5 mr-2 flex-shrink-0" />
                Balance automation with operator skill development
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="text-lg font-semibold text-blue-900 mb-3">Key Success Metrics</h4>
          <div className="grid md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="font-medium text-blue-900">Overall Equipment Effectiveness (OEE)</div>
              <div className="text-blue-700">Target: &gt;85%</div>
            </div>
            <div>
              <div className="font-medium text-blue-900">Predictive Maintenance Accuracy</div>
              <div className="text-blue-700">Target: &gt;90%</div>
            </div>
            <div>
              <div className="font-medium text-blue-900">Quality First Pass Yield</div>
              <div className="text-blue-700">Target: &gt;95%</div>
            </div>
            <div>
              <div className="font-medium text-blue-900">Energy Efficiency Improvement</div>
              <div className="text-blue-700">Target: 10-15%</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}