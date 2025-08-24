"""
Stream Processing Pipelines for Real-Time Data
===============================================

Comprehensive stream processing pipelines for:
- IoT sensor data aggregation and anomaly detection
- Financial transaction risk analysis and fraud scoring
- E-commerce recommendation engine and user behavior analysis
- Real-time analytics and machine learning inference

Features:
- Multi-stage pipeline processing
- Real-time aggregations and windowing
- Machine learning model inference
- Event correlation and pattern detection
- Performance optimization and scaling
"""

import asyncio
import json
import logging
import statistics
from abc import ABC, abstractmethod
from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Callable, AsyncGenerator
from enum import Enum

from app.core.redis_streams import StreamMessage, get_streams_client, EventType
from app.core.event_sourcing import (
    get_event_bus, 
    DomainEvent, 
    IoTDeviceEvents,
    publish_domain_event
)
from app.api.v1.websocket_manager import websocket_manager

logger = logging.getLogger(__name__)

# ==================== PIPELINE CORE TYPES ====================

class ProcessingStage(Enum):
    """Processing pipeline stages"""
    INGESTION = "ingestion"
    VALIDATION = "validation"
    ENRICHMENT = "enrichment"
    TRANSFORMATION = "transformation"
    AGGREGATION = "aggregation"
    ANALYSIS = "analysis"
    OUTPUT = "output"

class WindowType(Enum):
    """Time window types for aggregations"""
    TUMBLING = "tumbling"      # Non-overlapping fixed windows
    SLIDING = "sliding"        # Overlapping windows
    SESSION = "session"        # Based on activity gaps

@dataclass
class ProcessingResult:
    """Result of pipeline processing"""
    success: bool
    stage: ProcessingStage
    data: Dict[str, Any]
    metrics: Dict[str, float]
    alerts: List[Dict[str, Any]]
    next_stage_data: Optional[Dict[str, Any]] = None

@dataclass
class WindowConfig:
    """Configuration for time windows"""
    window_type: WindowType
    size_seconds: int
    slide_seconds: Optional[int] = None  # For sliding windows
    session_timeout_seconds: Optional[int] = None  # For session windows

# ==================== BASE PIPELINE CLASS ====================

class StreamProcessingPipeline(ABC):
    """Abstract base class for stream processing pipelines"""
    
    def __init__(self, pipeline_name: str):
        self.pipeline_name = pipeline_name
        self.stages: List[Callable] = []
        self.metrics = defaultdict(int)
        self.error_counts = defaultdict(int)
        self.processing_times = deque(maxlen=1000)
        self.running = False
    
    @abstractmethod
    async def process_message(self, message: StreamMessage) -> ProcessingResult:
        """Process a single message through the pipeline"""
        pass
    
    def add_stage(self, stage_func: Callable):
        """Add a processing stage to the pipeline"""
        self.stages.append(stage_func)
    
    async def execute_pipeline(self, data: Dict[str, Any], context: Dict[str, Any] = None) -> ProcessingResult:
        """Execute all stages of the pipeline"""
        
        current_data = data
        stage_results = []
        context = context or {}
        
        for i, stage_func in enumerate(self.stages):
            try:
                stage_name = getattr(stage_func, '__name__', f'stage_{i}')
                start_time = asyncio.get_event_loop().time()
                
                # Execute stage
                if asyncio.iscoroutinefunction(stage_func):
                    result = await stage_func(current_data, context)
                else:
                    result = stage_func(current_data, context)
                
                processing_time = asyncio.get_event_loop().time() - start_time
                self.processing_times.append(processing_time)
                
                stage_results.append(result)
                
                # Update data for next stage
                if result.next_stage_data:
                    current_data = result.next_stage_data
                
                # Update metrics
                self.metrics[f"{stage_name}_processed"] += 1
                self.metrics[f"{stage_name}_time"] += processing_time
                
                if not result.success:
                    self.error_counts[stage_name] += 1
                    logger.error(f"Stage {stage_name} failed in pipeline {self.pipeline_name}")
                    break
                    
            except Exception as e:
                stage_name = getattr(stage_func, '__name__', f'stage_{i}')
                self.error_counts[stage_name] += 1
                logger.error(f"Error in pipeline stage {stage_name}: {e}")
                
                return ProcessingResult(
                    success=False,
                    stage=ProcessingStage.ANALYSIS,
                    data=current_data,
                    metrics=dict(self.metrics),
                    alerts=[{"error": str(e), "stage": stage_name}]
                )
        
        # Aggregate results
        all_alerts = []
        all_metrics = dict(self.metrics)
        
        for result in stage_results:
            all_alerts.extend(result.alerts)
            all_metrics.update(result.metrics)
        
        return ProcessingResult(
            success=True,
            stage=ProcessingStage.OUTPUT,
            data=current_data,
            metrics=all_metrics,
            alerts=all_alerts
        )
    
    def get_pipeline_metrics(self) -> Dict[str, Any]:
        """Get pipeline performance metrics"""
        
        avg_processing_time = (
            statistics.mean(self.processing_times) 
            if self.processing_times else 0
        )
        
        total_processed = sum(
            count for metric, count in self.metrics.items() 
            if metric.endswith('_processed')
        )
        
        total_errors = sum(self.error_counts.values())
        error_rate = total_errors / max(1, total_processed)
        
        return {
            "pipeline_name": self.pipeline_name,
            "total_processed": total_processed,
            "total_errors": total_errors,
            "error_rate": error_rate,
            "avg_processing_time": avg_processing_time,
            "stages_count": len(self.stages),
            "detailed_metrics": dict(self.metrics),
            "error_breakdown": dict(self.error_counts)
        }

# ==================== IOT SENSOR PROCESSING PIPELINE ====================

class IoTSensorProcessingPipeline(StreamProcessingPipeline):
    """Pipeline for processing IoT sensor data"""
    
    def __init__(self):
        super().__init__("iot_sensor_processing")
        
        # Historical data for trend analysis
        self.sensor_windows = defaultdict(lambda: deque(maxlen=100))
        self.sensor_stats = defaultdict(lambda: {"min": 0, "max": 0, "avg": 0, "std": 0})
        self.alert_states = defaultdict(lambda: {"count": 0, "last_alert": None})
        
        # Configure pipeline stages
        self.add_stage(self.validate_sensor_data)
        self.add_stage(self.enrich_sensor_data)
        self.add_stage(self.detect_anomalies)
        self.add_stage(self.perform_aggregations)
        self.add_stage(self.generate_insights)
    
    async def process_message(self, message: StreamMessage) -> ProcessingResult:
        """Process IoT sensor message through pipeline"""
        
        try:
            # Extract sensor data
            sensor_data = message.data
            
            # Add message context
            context = {
                "message_id": message.id,
                "timestamp": message.timestamp,
                "correlation_id": message.correlation_id
            }
            
            # Execute pipeline
            return await self.execute_pipeline(sensor_data, context)
            
        except Exception as e:
            logger.error(f"Error processing IoT sensor message {message.id}: {e}")
            return ProcessingResult(
                success=False,
                stage=ProcessingStage.INGESTION,
                data={},
                metrics={},
                alerts=[{"error": str(e)}]
            )
    
    async def validate_sensor_data(self, data: Dict[str, Any], context: Dict[str, Any]) -> ProcessingResult:
        """Validate incoming sensor data"""
        
        required_fields = ["sensor_id", "sensor_type", "value", "timestamp"]
        missing_fields = [field for field in required_fields if field not in data]
        
        if missing_fields:
            return ProcessingResult(
                success=False,
                stage=ProcessingStage.VALIDATION,
                data=data,
                metrics={"validation_failures": 1},
                alerts=[{"error": f"Missing required fields: {missing_fields}"}]
            )
        
        # Validate data types and ranges
        alerts = []
        
        try:
            value = float(data["value"])
            data["value"] = value  # Ensure numeric
        except (ValueError, TypeError):
            alerts.append({"error": "Invalid sensor value - not numeric"})
        
        # Sensor type specific validation
        sensor_type = data.get("sensor_type")
        if sensor_type == "temperature" and (value < -50 or value > 100):
            alerts.append({"warning": "Temperature value outside expected range (-50 to 100)"})
        elif sensor_type == "pressure" and (value < 0 or value > 200):
            alerts.append({"warning": "Pressure value outside expected range (0 to 200)"})
        
        return ProcessingResult(
            success=len([a for a in alerts if "error" in a]) == 0,
            stage=ProcessingStage.VALIDATION,
            data=data,
            metrics={"validation_success": 1},
            alerts=alerts,
            next_stage_data=data
        )
    
    async def enrich_sensor_data(self, data: Dict[str, Any], context: Dict[str, Any]) -> ProcessingResult:
        """Enrich sensor data with additional context"""
        
        sensor_id = data["sensor_id"]
        sensor_type = data.get("sensor_type")
        
        # Add enrichment data
        enriched_data = data.copy()
        enriched_data.update({
            "processing_timestamp": datetime.utcnow().isoformat(),
            "pipeline_stage": "enrichment",
            "enrichment_version": "1.0"
        })
        
        # Add sensor metadata (in a real system, this might come from a database)
        sensor_metadata = {
            "location_zone": self._get_sensor_zone(sensor_id),
            "device_model": self._get_device_model(sensor_id),
            "calibration_date": "2024-01-01",  # Example
            "maintenance_status": "active"
        }
        
        enriched_data["sensor_metadata"] = sensor_metadata
        
        # Add historical context
        if sensor_id in self.sensor_windows:
            recent_readings = list(self.sensor_windows[sensor_id])[-10:]  # Last 10 readings
            if recent_readings:
                recent_values = [r["value"] for r in recent_readings]
                enriched_data["historical_context"] = {
                    "recent_avg": statistics.mean(recent_values),
                    "recent_trend": "increasing" if len(recent_values) >= 2 and recent_values[-1] > recent_values[-2] else "stable",
                    "readings_count": len(recent_readings)
                }
        
        return ProcessingResult(
            success=True,
            stage=ProcessingStage.ENRICHMENT,
            data=enriched_data,
            metrics={"enrichment_success": 1},
            alerts=[],
            next_stage_data=enriched_data
        )
    
    async def detect_anomalies(self, data: Dict[str, Any], context: Dict[str, Any]) -> ProcessingResult:
        """Detect anomalies in sensor data"""
        
        sensor_id = data["sensor_id"]
        sensor_type = data["sensor_type"]
        value = data["value"]
        
        alerts = []
        anomaly_data = {"anomalies_detected": []}
        
        # Store current reading
        reading = {
            "timestamp": data["timestamp"],
            "value": value,
            "sensor_type": sensor_type
        }
        self.sensor_windows[sensor_id].append(reading)
        
        # Update sensor statistics
        self._update_sensor_stats(sensor_id, value)
        
        # Statistical anomaly detection
        if len(self.sensor_windows[sensor_id]) >= 10:
            recent_values = [r["value"] for r in list(self.sensor_windows[sensor_id])[-20:]]
            mean_val = statistics.mean(recent_values)
            std_val = statistics.stdev(recent_values) if len(recent_values) > 1 else 0
            
            # Z-score based anomaly detection
            if std_val > 0:
                z_score = abs(value - mean_val) / std_val
                
                if z_score > 3:  # 3-sigma rule
                    anomaly = {
                        "type": "statistical_outlier",
                        "z_score": z_score,
                        "threshold": 3,
                        "severity": "high" if z_score > 4 else "medium"
                    }
                    anomaly_data["anomalies_detected"].append(anomaly)
                    
                    alerts.append({
                        "alert_type": "anomaly_detected",
                        "sensor_id": sensor_id,
                        "anomaly": anomaly,
                        "value": value,
                        "expected_range": f"{mean_val - 2*std_val:.2f} to {mean_val + 2*std_val:.2f}"
                    })
        
        # Threshold-based anomaly detection
        thresholds = self._get_sensor_thresholds(sensor_type)
        if thresholds:
            if value > thresholds.get("critical_high", float('inf')):
                anomaly = {"type": "critical_threshold_exceeded", "threshold": "critical_high", "severity": "critical"}
                anomaly_data["anomalies_detected"].append(anomaly)
                alerts.append({
                    "alert_type": "critical_threshold",
                    "sensor_id": sensor_id,
                    "value": value,
                    "threshold": thresholds["critical_high"],
                    "severity": "critical"
                })
            elif value < thresholds.get("critical_low", float('-inf')):
                anomaly = {"type": "critical_threshold_exceeded", "threshold": "critical_low", "severity": "critical"}
                anomaly_data["anomalies_detected"].append(anomaly)
                alerts.append({
                    "alert_type": "critical_threshold",
                    "sensor_id": sensor_id,
                    "value": value,
                    "threshold": thresholds["critical_low"],
                    "severity": "critical"
                })
        
        # Update output data
        output_data = data.copy()
        output_data["anomaly_analysis"] = anomaly_data
        
        return ProcessingResult(
            success=True,
            stage=ProcessingStage.ANALYSIS,
            data=output_data,
            metrics={"anomaly_checks": 1, "anomalies_found": len(anomaly_data["anomalies_detected"])},
            alerts=alerts,
            next_stage_data=output_data
        )
    
    async def perform_aggregations(self, data: Dict[str, Any], context: Dict[str, Any]) -> ProcessingResult:
        """Perform time-based aggregations"""
        
        sensor_id = data["sensor_id"]
        sensor_type = data["sensor_type"]
        value = data["value"]
        
        # Perform various aggregations
        aggregations = {}
        
        if len(self.sensor_windows[sensor_id]) >= 5:
            recent_values = [r["value"] for r in list(self.sensor_windows[sensor_id])[-5:]]
            aggregations["last_5_readings"] = {
                "min": min(recent_values),
                "max": max(recent_values),
                "avg": statistics.mean(recent_values),
                "std": statistics.stdev(recent_values) if len(recent_values) > 1 else 0
            }
        
        if len(self.sensor_windows[sensor_id]) >= 10:
            recent_values = [r["value"] for r in list(self.sensor_windows[sensor_id])[-10:]]
            aggregations["last_10_readings"] = {
                "min": min(recent_values),
                "max": max(recent_values),
                "avg": statistics.mean(recent_values),
                "std": statistics.stdev(recent_values) if len(recent_values) > 1 else 0
            }
        
        # Add aggregations to output data
        output_data = data.copy()
        output_data["aggregations"] = aggregations
        
        return ProcessingResult(
            success=True,
            stage=ProcessingStage.AGGREGATION,
            data=output_data,
            metrics={"aggregations_computed": len(aggregations)},
            alerts=[],
            next_stage_data=output_data
        )
    
    async def generate_insights(self, data: Dict[str, Any], context: Dict[str, Any]) -> ProcessingResult:
        """Generate actionable insights from processed data"""
        
        sensor_id = data["sensor_id"]
        insights = []
        alerts = []
        
        # Anomaly insights
        anomalies = data.get("anomaly_analysis", {}).get("anomalies_detected", [])
        if anomalies:
            for anomaly in anomalies:
                if anomaly["severity"] == "critical":
                    insights.append({
                        "insight_type": "critical_anomaly",
                        "message": f"Critical anomaly detected in sensor {sensor_id}",
                        "recommended_actions": [
                            "Immediate inspection required",
                            "Check sensor calibration",
                            "Verify equipment status"
                        ],
                        "priority": "high"
                    })
                    
                    # Publish domain event for critical anomalies
                    alert_event = IoTDeviceEvents.alert_triggered(
                        device_id=sensor_id,
                        alert_data={
                            "alert_type": "critical_anomaly",
                            "anomaly_details": anomaly,
                            "sensor_value": data["value"],
                            "timestamp": datetime.utcnow().isoformat()
                        },
                        correlation_id=context.get("correlation_id")
                    )
                    
                    await publish_domain_event(alert_event)
        
        # Trend insights
        aggregations = data.get("aggregations", {})
        if "last_10_readings" in aggregations:
            agg_data = aggregations["last_10_readings"]
            coefficient_of_variation = agg_data["std"] / agg_data["avg"] if agg_data["avg"] != 0 else 0
            
            if coefficient_of_variation > 0.3:  # High variability
                insights.append({
                    "insight_type": "high_variability",
                    "message": f"High variability detected in sensor {sensor_id}",
                    "coefficient_of_variation": coefficient_of_variation,
                    "recommended_actions": [
                        "Check for intermittent issues",
                        "Review sensor mounting",
                        "Consider recalibration"
                    ],
                    "priority": "medium"
                })
        
        # Performance insights
        historical_context = data.get("historical_context", {})
        if historical_context.get("recent_trend") == "increasing":
            insights.append({
                "insight_type": "trend_analysis",
                "message": f"Increasing trend detected in sensor {sensor_id}",
                "trend_direction": "increasing",
                "recommended_actions": [
                    "Monitor for continued increase",
                    "Check if within normal operational range"
                ],
                "priority": "low"
            })
        
        # Add insights to output
        output_data = data.copy()
        output_data["insights"] = insights
        
        return ProcessingResult(
            success=True,
            stage=ProcessingStage.OUTPUT,
            data=output_data,
            metrics={"insights_generated": len(insights)},
            alerts=alerts
        )
    
    def _get_sensor_zone(self, sensor_id: str) -> str:
        """Get sensor location zone (mock implementation)"""
        # In a real system, this would query a database
        if "temp" in sensor_id:
            return "Factory_Floor"
        elif "pressure" in sensor_id:
            return "Pipeline_Section"
        elif "vibration" in sensor_id:
            return "Motor_Hall"
        else:
            return "General_Area"
    
    def _get_device_model(self, sensor_id: str) -> str:
        """Get device model (mock implementation)"""
        if "temp" in sensor_id:
            return "TempSensor_X1000"
        elif "pressure" in sensor_id:
            return "PressureSensor_P500"
        else:
            return "GenericSensor_G100"
    
    def _update_sensor_stats(self, sensor_id: str, value: float):
        """Update sensor statistics"""
        stats = self.sensor_stats[sensor_id]
        
        if stats["min"] == 0 and stats["max"] == 0:  # First reading
            stats["min"] = stats["max"] = stats["avg"] = value
        else:
            stats["min"] = min(stats["min"], value)
            stats["max"] = max(stats["max"], value)
            
            # Update rolling average (simplified)
            stats["avg"] = (stats["avg"] * 0.9 + value * 0.1)
    
    def _get_sensor_thresholds(self, sensor_type: str) -> Optional[Dict[str, float]]:
        """Get sensor-specific thresholds"""
        thresholds = {
            "temperature": {"critical_high": 50.0, "critical_low": -10.0},
            "pressure": {"critical_high": 150.0, "critical_low": 10.0},
            "vibration": {"critical_high": 10.0, "critical_low": 0.0},
            "humidity": {"critical_high": 90.0, "critical_low": 10.0}
        }
        
        return thresholds.get(sensor_type)

# ==================== FINANCIAL TRANSACTION PIPELINE ====================

class FinancialTransactionPipeline(StreamProcessingPipeline):
    """Pipeline for processing financial transactions"""
    
    def __init__(self):
        super().__init__("financial_transaction_processing")
        
        # Fraud detection models and data
        self.customer_profiles = {}
        self.transaction_patterns = defaultdict(list)
        self.fraud_rules = self._initialize_fraud_rules()
        
        # Configure pipeline stages
        self.add_stage(self.validate_transaction)
        self.add_stage(self.enrich_transaction)
        self.add_stage(self.calculate_risk_score)
        self.add_stage(self.apply_fraud_rules)
        self.add_stage(self.generate_recommendations)
    
    async def process_message(self, message: StreamMessage) -> ProcessingResult:
        """Process financial transaction message"""
        
        try:
            transaction_data = message.data
            
            context = {
                "message_id": message.id,
                "timestamp": message.timestamp,
                "correlation_id": message.correlation_id
            }
            
            return await self.execute_pipeline(transaction_data, context)
            
        except Exception as e:
            logger.error(f"Error processing financial transaction {message.id}: {e}")
            return ProcessingResult(
                success=False,
                stage=ProcessingStage.INGESTION,
                data={},
                metrics={},
                alerts=[{"error": str(e)}]
            )
    
    async def validate_transaction(self, data: Dict[str, Any], context: Dict[str, Any]) -> ProcessingResult:
        """Validate transaction data"""
        
        required_fields = ["transaction_id", "customer_id", "amount", "merchant_id"]
        missing_fields = [field for field in required_fields if field not in data]
        
        alerts = []
        
        if missing_fields:
            alerts.append({"error": f"Missing required fields: {missing_fields}"})
        
        # Validate amount
        try:
            amount = float(data.get("amount", 0))
            if amount <= 0:
                alerts.append({"error": "Transaction amount must be positive"})
            elif amount > 100000:  # $100k limit
                alerts.append({"warning": "Large transaction amount detected"})
            
            data["amount"] = amount
            
        except (ValueError, TypeError):
            alerts.append({"error": "Invalid transaction amount"})
        
        success = len([a for a in alerts if "error" in a]) == 0
        
        return ProcessingResult(
            success=success,
            stage=ProcessingStage.VALIDATION,
            data=data,
            metrics={"validation_success" if success else "validation_failure": 1},
            alerts=alerts,
            next_stage_data=data if success else None
        )
    
    async def enrich_transaction(self, data: Dict[str, Any], context: Dict[str, Any]) -> ProcessingResult:
        """Enrich transaction with additional data"""
        
        customer_id = data["customer_id"]
        merchant_id = data["merchant_id"]
        
        # Enrich with customer data
        customer_profile = self._get_customer_profile(customer_id)
        merchant_profile = self._get_merchant_profile(merchant_id)
        
        enriched_data = data.copy()
        enriched_data.update({
            "customer_profile": customer_profile,
            "merchant_profile": merchant_profile,
            "processing_timestamp": datetime.utcnow().isoformat(),
            "enrichment_version": "1.0"
        })
        
        # Add transaction history context
        recent_transactions = self.transaction_patterns[customer_id][-10:]  # Last 10 transactions
        if recent_transactions:
            enriched_data["transaction_history"] = {
                "recent_count": len(recent_transactions),
                "avg_amount": statistics.mean([t["amount"] for t in recent_transactions]),
                "frequent_merchants": list(set([t.get("merchant_id") for t in recent_transactions]))
            }
        
        return ProcessingResult(
            success=True,
            stage=ProcessingStage.ENRICHMENT,
            data=enriched_data,
            metrics={"enrichment_success": 1},
            alerts=[],
            next_stage_data=enriched_data
        )
    
    async def calculate_risk_score(self, data: Dict[str, Any], context: Dict[str, Any]) -> ProcessingResult:
        """Calculate transaction risk score"""
        
        risk_factors = []
        risk_score = 0.0
        
        amount = data["amount"]
        customer_profile = data.get("customer_profile", {})
        merchant_profile = data.get("merchant_profile", {})
        transaction_history = data.get("transaction_history", {})
        
        # Amount-based risk
        if amount > customer_profile.get("avg_transaction_amount", 100) * 5:
            risk_factors.append("unusually_large_amount")
            risk_score += 0.3
        
        # Merchant risk
        if merchant_profile.get("risk_level") == "high":
            risk_factors.append("high_risk_merchant")
            risk_score += 0.4
        
        # Frequency risk
        recent_count = transaction_history.get("recent_count", 0)
        if recent_count > 10:  # Many recent transactions
            risk_factors.append("high_frequency")
            risk_score += 0.2
        
        # Time-based risk (simplified - in production would check actual time patterns)
        current_hour = datetime.utcnow().hour
        if current_hour < 6 or current_hour > 23:  # Outside normal hours
            risk_factors.append("unusual_time")
            risk_score += 0.1
        
        # Location risk (simplified)
        customer_location = customer_profile.get("location", "unknown")
        merchant_location = merchant_profile.get("location", "unknown")
        if customer_location != merchant_location and customer_location != "unknown":
            risk_factors.append("location_mismatch")
            risk_score += 0.2
        
        # Cap at 1.0
        risk_score = min(risk_score, 1.0)
        
        # Update data with risk analysis
        output_data = data.copy()
        output_data["risk_analysis"] = {
            "risk_score": risk_score,
            "risk_factors": risk_factors,
            "risk_level": "high" if risk_score > 0.7 else "medium" if risk_score > 0.3 else "low"
        }
        
        return ProcessingResult(
            success=True,
            stage=ProcessingStage.ANALYSIS,
            data=output_data,
            metrics={"risk_calculations": 1},
            alerts=[],
            next_stage_data=output_data
        )
    
    async def apply_fraud_rules(self, data: Dict[str, Any], context: Dict[str, Any]) -> ProcessingResult:
        """Apply fraud detection rules"""
        
        alerts = []
        fraud_indicators = []
        
        risk_analysis = data.get("risk_analysis", {})
        risk_score = risk_analysis.get("risk_score", 0)
        
        # Apply fraud rules
        for rule in self.fraud_rules:
            if await self._evaluate_fraud_rule(rule, data):
                fraud_indicators.append(rule["name"])
                
                if rule["severity"] == "critical":
                    alerts.append({
                        "alert_type": "fraud_detection",
                        "rule": rule["name"],
                        "severity": "critical",
                        "transaction_id": data["transaction_id"],
                        "recommended_action": "block_transaction"
                    })
                elif rule["severity"] == "warning":
                    alerts.append({
                        "alert_type": "fraud_warning",
                        "rule": rule["name"],
                        "severity": "warning",
                        "transaction_id": data["transaction_id"],
                        "recommended_action": "review_transaction"
                    })
        
        # Update fraud score based on rules triggered
        final_fraud_score = risk_score + (len(fraud_indicators) * 0.1)
        final_fraud_score = min(final_fraud_score, 1.0)
        
        # Update data
        output_data = data.copy()
        output_data["fraud_analysis"] = {
            "fraud_score": final_fraud_score,
            "fraud_indicators": fraud_indicators,
            "rules_triggered": len(fraud_indicators),
            "recommendation": self._get_fraud_recommendation(final_fraud_score)
        }
        
        return ProcessingResult(
            success=True,
            stage=ProcessingStage.ANALYSIS,
            data=output_data,
            metrics={"fraud_rules_applied": len(self.fraud_rules), "fraud_indicators": len(fraud_indicators)},
            alerts=alerts,
            next_stage_data=output_data
        )
    
    async def generate_recommendations(self, data: Dict[str, Any], context: Dict[str, Any]) -> ProcessingResult:
        """Generate actionable recommendations"""
        
        recommendations = []
        
        fraud_analysis = data.get("fraud_analysis", {})
        fraud_score = fraud_analysis.get("fraud_score", 0)
        
        if fraud_score > 0.8:
            recommendations.append({
                "type": "block_transaction",
                "priority": "critical",
                "message": "Block transaction due to high fraud risk",
                "actions": ["Decline transaction", "Flag account for review", "Notify customer"]
            })
        elif fraud_score > 0.5:
            recommendations.append({
                "type": "manual_review",
                "priority": "high",
                "message": "Transaction requires manual review",
                "actions": ["Hold for review", "Request additional verification", "Check recent activity"]
            })
        elif fraud_score > 0.3:
            recommendations.append({
                "type": "enhanced_monitoring",
                "priority": "medium",
                "message": "Increase monitoring for this customer",
                "actions": ["Monitor next 5 transactions", "Check for patterns"]
            })
        
        # Store transaction for pattern analysis
        customer_id = data["customer_id"]
        transaction_summary = {
            "transaction_id": data["transaction_id"],
            "amount": data["amount"],
            "merchant_id": data.get("merchant_id"),
            "fraud_score": fraud_score,
            "timestamp": data.get("processing_timestamp")
        }
        self.transaction_patterns[customer_id].append(transaction_summary)
        
        # Keep only recent transactions (last 100)
        if len(self.transaction_patterns[customer_id]) > 100:
            self.transaction_patterns[customer_id] = self.transaction_patterns[customer_id][-100:]
        
        # Update output
        output_data = data.copy()
        output_data["recommendations"] = recommendations
        
        return ProcessingResult(
            success=True,
            stage=ProcessingStage.OUTPUT,
            data=output_data,
            metrics={"recommendations_generated": len(recommendations)},
            alerts=[]
        )
    
    def _initialize_fraud_rules(self) -> List[Dict[str, Any]]:
        """Initialize fraud detection rules"""
        return [
            {
                "name": "large_amount_rule",
                "condition": lambda data: data["amount"] > 10000,
                "severity": "warning"
            },
            {
                "name": "very_large_amount_rule",
                "condition": lambda data: data["amount"] > 50000,
                "severity": "critical"
            },
            {
                "name": "high_risk_merchant_rule",
                "condition": lambda data: data.get("merchant_profile", {}).get("risk_level") == "high",
                "severity": "warning"
            },
            {
                "name": "multiple_rapid_transactions",
                "condition": lambda data: len(self.transaction_patterns.get(data["customer_id"], [])) > 5,
                "severity": "warning"
            }
        ]
    
    async def _evaluate_fraud_rule(self, rule: Dict[str, Any], data: Dict[str, Any]) -> bool:
        """Evaluate a fraud detection rule"""
        try:
            return rule["condition"](data)
        except Exception as e:
            logger.error(f"Error evaluating fraud rule {rule['name']}: {e}")
            return False
    
    def _get_fraud_recommendation(self, fraud_score: float) -> str:
        """Get recommendation based on fraud score"""
        if fraud_score > 0.8:
            return "block"
        elif fraud_score > 0.5:
            return "review"
        elif fraud_score > 0.3:
            return "monitor"
        else:
            return "approve"
    
    def _get_customer_profile(self, customer_id: str) -> Dict[str, Any]:
        """Get customer profile (mock implementation)"""
        # In a real system, this would query a database
        return {
            "customer_id": customer_id,
            "risk_level": "medium",
            "avg_transaction_amount": 150.0,
            "location": "US",
            "account_age_days": 365,
            "previous_fraud_incidents": 0
        }
    
    def _get_merchant_profile(self, merchant_id: str) -> Dict[str, Any]:
        """Get merchant profile (mock implementation)"""
        return {
            "merchant_id": merchant_id,
            "risk_level": "low",
            "category": "retail",
            "location": "US",
            "fraud_rate": 0.02
        }

# ==================== PIPELINE ORCHESTRATOR ====================

class StreamProcessingOrchestrator:
    """Orchestrates multiple stream processing pipelines"""
    
    def __init__(self):
        self.pipelines: Dict[str, StreamProcessingPipeline] = {}
        self.running = False
        
    def register_pipeline(self, stream_type: str, pipeline: StreamProcessingPipeline):
        """Register a pipeline for a specific stream type"""
        self.pipelines[stream_type] = pipeline
        logger.info(f"Registered pipeline {pipeline.pipeline_name} for stream type {stream_type}")
    
    async def start_processing(self):
        """Start processing all registered pipelines"""
        if not self.pipelines:
            logger.warning("No pipelines registered")
            return
        
        self.running = True
        logger.info("Starting stream processing orchestrator")
        
        # In a real implementation, you would start consumers here
        # For now, we'll just mark as running
        
    def stop_processing(self):
        """Stop all pipeline processing"""
        self.running = False
        logger.info("Stopped stream processing orchestrator")
    
    async def process_message(self, stream_type: str, message: StreamMessage) -> Optional[ProcessingResult]:
        """Process a message through the appropriate pipeline"""
        
        if stream_type not in self.pipelines:
            logger.warning(f"No pipeline registered for stream type {stream_type}")
            return None
        
        pipeline = self.pipelines[stream_type]
        
        try:
            result = await pipeline.process_message(message)
            
            # Broadcast critical alerts via WebSocket
            for alert in result.alerts:
                if alert.get("severity") in ["critical", "high"]:
                    await self._broadcast_alert(stream_type, alert)
            
            return result
            
        except Exception as e:
            logger.error(f"Error processing message in pipeline {pipeline.pipeline_name}: {e}")
            return None
    
    async def _broadcast_alert(self, stream_type: str, alert: Dict[str, Any]):
        """Broadcast critical alerts via WebSocket"""
        try:
            await websocket_manager.broadcast_system_event(
                event_type=websocket_manager.EventType.SYSTEM_ALERT,
                data={
                    "alert_type": "stream_processing_alert",
                    "stream_type": stream_type,
                    "alert": alert,
                    "timestamp": datetime.utcnow().isoformat()
                }
            )
        except Exception as e:
            logger.error(f"Failed to broadcast alert: {e}")
    
    def get_orchestrator_metrics(self) -> Dict[str, Any]:
        """Get metrics for all pipelines"""
        
        metrics = {
            "orchestrator_running": self.running,
            "pipelines_count": len(self.pipelines),
            "pipelines": {}
        }
        
        for stream_type, pipeline in self.pipelines.items():
            metrics["pipelines"][stream_type] = pipeline.get_pipeline_metrics()
        
        return metrics

# ==================== GLOBAL ORCHESTRATOR INSTANCE ====================

# Global orchestrator
processing_orchestrator = StreamProcessingOrchestrator()

def initialize_processing_pipelines():
    """Initialize all processing pipelines"""
    
    # Register pipelines
    processing_orchestrator.register_pipeline("iot_sensors", IoTSensorProcessingPipeline())
    processing_orchestrator.register_pipeline("financial_transactions", FinancialTransactionPipeline())
    
    logger.info("Stream processing pipelines initialized")

async def start_stream_processing():
    """Start stream processing"""
    initialize_processing_pipelines()
    await processing_orchestrator.start_processing()

def stop_stream_processing():
    """Stop stream processing"""
    processing_orchestrator.stop_processing()

def get_processing_metrics() -> Dict[str, Any]:
    """Get processing metrics"""
    return processing_orchestrator.get_orchestrator_metrics()