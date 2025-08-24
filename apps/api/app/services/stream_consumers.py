"""
Stream Consumer Services for Real-Time Data Processing
======================================================

Comprehensive stream consumers for processing real-time data:
- IoT sensor data analysis and alerting
- Financial transaction fraud detection
- E-commerce recommendation engine
- Real-time analytics and insights generation

Features:
- High-performance parallel processing
- Automatic error handling and retry logic
- Dead letter queue management
- Real-time alerts and notifications
- Stream processing coordination
"""

import asyncio
import json
import logging
import time
import statistics
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Callable
from collections import defaultdict, deque
from dataclasses import dataclass
from enum import Enum

from app.core.redis_streams import (
    get_streams_client, 
    StreamMessage, 
    ConsumerConfig, 
    StreamType, 
    EventType
)
from app.api.v1.websocket_manager import websocket_manager

logger = logging.getLogger(__name__)

class AlertLevel(Enum):
    """Alert severity levels"""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
    EMERGENCY = "emergency"

@dataclass
class ProcessingResult:
    """Result of stream message processing"""
    success: bool
    message_id: str
    processing_time: float
    insights: List[Dict[str, Any]]
    alerts: List[Dict[str, Any]]
    errors: List[str]
    metadata: Dict[str, Any]

class IoTSensorConsumer:
    """Consumer for IoT sensor data streams"""
    
    def __init__(self):
        self.sensor_history = defaultdict(lambda: deque(maxlen=100))
        self.alert_thresholds = {
            "temperature": {"warning": 28.0, "critical": 30.0},
            "pressure": {"warning": 108.0, "critical": 110.0},
            "vibration": {"warning": 3.0, "critical": 5.0},
            "humidity": {"warning": 70.0, "critical": 80.0}
        }
        self.consecutive_alerts = defaultdict(int)
        
    async def process_sensor_reading(self, message: StreamMessage) -> ProcessingResult:
        """Process IoT sensor reading and generate insights/alerts"""
        
        start_time = time.time()
        insights = []
        alerts = []
        errors = []
        
        try:
            data = message.data
            sensor_id = data.get("sensor_id")
            sensor_type = data.get("sensor_type")
            value = data.get("value")
            location = data.get("location", "unknown")
            timestamp = data.get("timestamp")
            
            if not all([sensor_id, sensor_type, value is not None]):
                errors.append("Missing required sensor data fields")
                return ProcessingResult(
                    success=False,
                    message_id=message.id,
                    processing_time=time.time() - start_time,
                    insights=insights,
                    alerts=alerts,
                    errors=errors,
                    metadata={"sensor_id": sensor_id}
                )
            
            # Store in sensor history
            self.sensor_history[sensor_id].append({
                "timestamp": timestamp,
                "value": value,
                "sensor_type": sensor_type
            })
            
            # Analyze sensor reading
            analysis_result = await self._analyze_sensor_reading(
                sensor_id, sensor_type, value, location
            )
            
            insights.extend(analysis_result["insights"])
            alerts.extend(analysis_result["alerts"])
            
            # Generate pattern insights if enough history
            if len(self.sensor_history[sensor_id]) >= 10:
                pattern_insights = self._analyze_sensor_patterns(sensor_id)
                insights.extend(pattern_insights)
            
            # Send alerts via WebSocket if critical
            for alert in alerts:
                if alert["level"] in ["critical", "emergency"]:
                    await self._broadcast_alert(alert)
            
            processing_time = time.time() - start_time
            
            logger.debug(f"Processed sensor reading from {sensor_id}: {len(insights)} insights, {len(alerts)} alerts")
            
            return ProcessingResult(
                success=True,
                message_id=message.id,
                processing_time=processing_time,
                insights=insights,
                alerts=alerts,
                errors=errors,
                metadata={
                    "sensor_id": sensor_id,
                    "sensor_type": sensor_type,
                    "location": location
                }
            )
            
        except Exception as e:
            errors.append(f"Error processing sensor reading: {str(e)}")
            logger.error(f"Error processing IoT sensor message {message.id}: {e}")
            
            return ProcessingResult(
                success=False,
                message_id=message.id,
                processing_time=time.time() - start_time,
                insights=insights,
                alerts=alerts,
                errors=errors,
                metadata={}
            )
    
    async def _analyze_sensor_reading(
        self, 
        sensor_id: str, 
        sensor_type: str, 
        value: float, 
        location: str
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Analyze individual sensor reading"""
        
        insights = []
        alerts = []
        
        # Get thresholds for sensor type
        thresholds = self.alert_thresholds.get(sensor_type, {})
        
        if not thresholds:
            return {"insights": insights, "alerts": alerts}
        
        # Check for threshold violations
        alert_level = None
        if value >= thresholds.get("critical", float('inf')):
            alert_level = AlertLevel.CRITICAL
        elif value >= thresholds.get("warning", float('inf')):
            alert_level = AlertLevel.WARNING
        
        if alert_level:
            # Increment consecutive alert count
            self.consecutive_alerts[sensor_id] += 1
            
            # Escalate if multiple consecutive alerts
            if self.consecutive_alerts[sensor_id] >= 3 and alert_level == AlertLevel.CRITICAL:
                alert_level = AlertLevel.EMERGENCY
            
            alert = {
                "alert_id": f"alert_{sensor_id}_{int(time.time())}",
                "sensor_id": sensor_id,
                "sensor_type": sensor_type,
                "location": location,
                "level": alert_level.value,
                "message": f"{sensor_type.title()} reading of {value} exceeds {alert_level.value} threshold",
                "value": value,
                "threshold": thresholds.get(alert_level.value.lower(), value),
                "consecutive_alerts": self.consecutive_alerts[sensor_id],
                "timestamp": datetime.utcnow().isoformat(),
                "recommended_actions": self._get_recommended_actions(sensor_type, alert_level)
            }
            
            alerts.append(alert)
        else:
            # Reset consecutive alert count
            self.consecutive_alerts[sensor_id] = 0
        
        # Generate operational insights
        if len(self.sensor_history[sensor_id]) >= 5:
            recent_values = [reading["value"] for reading in list(self.sensor_history[sensor_id])[-5:]]
            avg_recent = sum(recent_values) / len(recent_values)
            
            if abs(value - avg_recent) > avg_recent * 0.2:  # 20% deviation
                insights.append({
                    "insight_id": f"insight_{sensor_id}_{int(time.time())}",
                    "type": "deviation_detected",
                    "sensor_id": sensor_id,
                    "message": f"Significant deviation detected: current {value} vs recent average {avg_recent:.2f}",
                    "severity": "medium",
                    "timestamp": datetime.utcnow().isoformat()
                })
        
        return {"insights": insights, "alerts": alerts}
    
    def _analyze_sensor_patterns(self, sensor_id: str) -> List[Dict[str, Any]]:
        """Analyze sensor patterns over time"""
        
        insights = []
        history = list(self.sensor_history[sensor_id])
        
        if len(history) < 10:
            return insights
        
        # Extract values and timestamps
        values = [reading["value"] for reading in history]
        
        # Detect trends
        if len(values) >= 10:
            recent_half = values[-5:]
            older_half = values[-10:-5]
            
            recent_avg = sum(recent_half) / len(recent_half)
            older_avg = sum(older_half) / len(older_half)
            
            trend_change = (recent_avg - older_avg) / older_avg if older_avg != 0 else 0
            
            if abs(trend_change) > 0.1:  # 10% change
                trend_direction = "increasing" if trend_change > 0 else "decreasing"
                insights.append({
                    "insight_id": f"trend_{sensor_id}_{int(time.time())}",
                    "type": "trend_analysis",
                    "sensor_id": sensor_id,
                    "message": f"Sensor showing {trend_direction} trend: {trend_change:.1%} change",
                    "trend_direction": trend_direction,
                    "trend_magnitude": abs(trend_change),
                    "severity": "low",
                    "timestamp": datetime.utcnow().isoformat()
                })
        
        # Detect variability changes
        if len(values) >= 20:
            recent_std = statistics.stdev(values[-10:])
            older_std = statistics.stdev(values[-20:-10])
            
            variability_change = (recent_std - older_std) / older_std if older_std != 0 else 0
            
            if abs(variability_change) > 0.5:  # 50% change in variability
                insights.append({
                    "insight_id": f"variability_{sensor_id}_{int(time.time())}",
                    "type": "variability_analysis",
                    "sensor_id": sensor_id,
                    "message": f"Sensor variability changed by {variability_change:.1%}",
                    "variability_change": variability_change,
                    "severity": "medium",
                    "timestamp": datetime.utcnow().isoformat()
                })
        
        return insights
    
    def _get_recommended_actions(self, sensor_type: str, alert_level: AlertLevel) -> List[str]:
        """Get recommended actions for alerts"""
        
        actions = {
            "temperature": {
                AlertLevel.WARNING: ["Check cooling system", "Monitor for 15 minutes"],
                AlertLevel.CRITICAL: ["Activate backup cooling", "Inspect equipment", "Notify maintenance"],
                AlertLevel.EMERGENCY: ["Emergency shutdown", "Evacuate area", "Call emergency response"]
            },
            "pressure": {
                AlertLevel.WARNING: ["Check pressure relief valve", "Monitor system"],
                AlertLevel.CRITICAL: ["Reduce system pressure", "Inspect for leaks", "Alert supervisor"],
                AlertLevel.EMERGENCY: ["Emergency shutdown", "Isolate system", "Call emergency response"]
            },
            "vibration": {
                AlertLevel.WARNING: ["Schedule maintenance check", "Monitor equipment"],
                AlertLevel.CRITICAL: ["Stop equipment", "Inspect bearings", "Call technician"],
                AlertLevel.EMERGENCY: ["Emergency stop", "Evacuate area", "Call maintenance emergency"]
            }
        }
        
        return actions.get(sensor_type, {}).get(alert_level, ["Contact maintenance"])
    
    async def _broadcast_alert(self, alert: Dict[str, Any]):
        """Broadcast critical alerts via WebSocket"""
        
        try:
            await websocket_manager.broadcast_system_event(
                event_type=websocket_manager.EventType.SYSTEM_ALERT,
                data={
                    "alert_type": "iot_sensor_alert",
                    "alert": alert
                }
            )
        except Exception as e:
            logger.error(f"Failed to broadcast alert: {e}")

class FinancialTransactionConsumer:
    """Consumer for financial transaction streams"""
    
    def __init__(self):
        self.fraud_model_threshold = 0.75
        self.customer_profiles = {}
        self.transaction_patterns = defaultdict(list)
        
    async def process_transaction(self, message: StreamMessage) -> ProcessingResult:
        """Process financial transaction and detect fraud"""
        
        start_time = time.time()
        insights = []
        alerts = []
        errors = []
        
        try:
            data = message.data
            transaction_id = data.get("transaction_id")
            customer_id = data.get("customer_id")
            amount = data.get("amount")
            fraud_score = data.get("fraud_score", 0.0)
            
            if not all([transaction_id, customer_id, amount is not None]):
                errors.append("Missing required transaction fields")
                return ProcessingResult(
                    success=False,
                    message_id=message.id,
                    processing_time=time.time() - start_time,
                    insights=insights,
                    alerts=alerts,
                    errors=errors,
                    metadata={"transaction_id": transaction_id}
                )
            
            # Update customer profile
            await self._update_customer_profile(customer_id, data)
            
            # Enhanced fraud detection
            enhanced_fraud_score = await self._enhanced_fraud_detection(customer_id, data)
            
            # Generate transaction insights
            transaction_insights = await self._analyze_transaction_patterns(customer_id, data)
            insights.extend(transaction_insights)
            
            # Check for fraud alerts
            if enhanced_fraud_score > self.fraud_model_threshold:
                fraud_alert = {
                    "alert_id": f"fraud_{transaction_id}",
                    "transaction_id": transaction_id,
                    "customer_id": customer_id,
                    "level": "critical" if enhanced_fraud_score > 0.9 else "warning",
                    "fraud_score": enhanced_fraud_score,
                    "amount": amount,
                    "message": f"High fraud risk transaction detected (score: {enhanced_fraud_score:.3f})",
                    "recommended_actions": [
                        "Hold transaction for review",
                        "Contact customer for verification",
                        "Check recent account activity"
                    ],
                    "timestamp": datetime.utcnow().isoformat()
                }
                
                alerts.append(fraud_alert)
                
                # Broadcast critical fraud alerts
                if enhanced_fraud_score > 0.9:
                    await self._broadcast_fraud_alert(fraud_alert)
            
            # Risk scoring insights
            if enhanced_fraud_score > 0.5:
                insights.append({
                    "insight_id": f"risk_{transaction_id}",
                    "type": "risk_assessment",
                    "transaction_id": transaction_id,
                    "message": f"Elevated risk transaction: score {enhanced_fraud_score:.3f}",
                    "risk_factors": data.get("fraud_indicators", []),
                    "severity": "medium",
                    "timestamp": datetime.utcnow().isoformat()
                })
            
            processing_time = time.time() - start_time
            
            return ProcessingResult(
                success=True,
                message_id=message.id,
                processing_time=processing_time,
                insights=insights,
                alerts=alerts,
                errors=errors,
                metadata={
                    "transaction_id": transaction_id,
                    "customer_id": customer_id,
                    "fraud_score": enhanced_fraud_score
                }
            )
            
        except Exception as e:
            errors.append(f"Error processing transaction: {str(e)}")
            logger.error(f"Error processing financial transaction {message.id}: {e}")
            
            return ProcessingResult(
                success=False,
                message_id=message.id,
                processing_time=time.time() - start_time,
                insights=insights,
                alerts=alerts,
                errors=errors,
                metadata={}
            )
    
    async def _update_customer_profile(self, customer_id: str, transaction_data: Dict[str, Any]):
        """Update customer behavioral profile"""
        
        if customer_id not in self.customer_profiles:
            self.customer_profiles[customer_id] = {
                "transaction_count": 0,
                "total_amount": 0.0,
                "avg_amount": 0.0,
                "preferred_merchants": {},
                "transaction_times": [],
                "locations": set(),
                "first_seen": datetime.utcnow().isoformat()
            }
        
        profile = self.customer_profiles[customer_id]
        profile["transaction_count"] += 1
        profile["total_amount"] += transaction_data["amount"]
        profile["avg_amount"] = profile["total_amount"] / profile["transaction_count"]
        
        # Track merchant preferences
        merchant_category = transaction_data.get("merchant_category", "unknown")
        if merchant_category in profile["preferred_merchants"]:
            profile["preferred_merchants"][merchant_category] += 1
        else:
            profile["preferred_merchants"][merchant_category] = 1
        
        # Track transaction timing
        profile["transaction_times"].append(datetime.utcnow().hour)
        if len(profile["transaction_times"]) > 100:  # Keep last 100 transaction times
            profile["transaction_times"] = profile["transaction_times"][-100:]
        
        # Track locations
        profile["locations"].add(transaction_data.get("customer_location", "unknown"))
    
    async def _enhanced_fraud_detection(self, customer_id: str, transaction_data: Dict[str, Any]) -> float:
        """Enhanced fraud detection using customer behavioral patterns"""
        
        base_fraud_score = transaction_data.get("fraud_score", 0.0)
        profile = self.customer_profiles.get(customer_id)
        
        if not profile:
            return base_fraud_score
        
        enhancement_factors = []
        
        # Amount deviation analysis
        amount = transaction_data["amount"]
        if profile["transaction_count"] > 5:
            amount_ratio = amount / profile["avg_amount"] if profile["avg_amount"] > 0 else 1
            if amount_ratio > 5:  # Transaction is 5x normal
                enhancement_factors.append(0.3)
            elif amount_ratio > 2:  # Transaction is 2x normal
                enhancement_factors.append(0.1)
        
        # Merchant category analysis
        merchant_category = transaction_data.get("merchant_category", "unknown")
        if merchant_category not in profile["preferred_merchants"]:
            enhancement_factors.append(0.2)  # New merchant category
        
        # Time pattern analysis
        current_hour = datetime.utcnow().hour
        if len(profile["transaction_times"]) > 10:
            common_hours = set(profile["transaction_times"])
            if current_hour not in common_hours:
                enhancement_factors.append(0.15)  # Unusual time
        
        # Location analysis
        customer_location = transaction_data.get("customer_location", "unknown")
        if customer_location not in profile["locations"]:
            enhancement_factors.append(0.25)  # New location
        
        # Calculate enhanced score
        enhancement = sum(enhancement_factors)
        enhanced_score = min(1.0, base_fraud_score + enhancement)
        
        return enhanced_score
    
    async def _analyze_transaction_patterns(self, customer_id: str, transaction_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Analyze transaction patterns for insights"""
        
        insights = []
        profile = self.customer_profiles.get(customer_id)
        
        if not profile or profile["transaction_count"] < 10:
            return insights
        
        # Spending pattern insights
        amount = transaction_data["amount"]
        if amount > profile["avg_amount"] * 3:
            insights.append({
                "insight_id": f"spending_{customer_id}_{int(time.time())}",
                "type": "spending_pattern",
                "customer_id": customer_id,
                "message": f"Large transaction: {amount} vs avg {profile['avg_amount']:.2f}",
                "severity": "medium",
                "timestamp": datetime.utcnow().isoformat()
            })
        
        # Merchant diversity insight
        if len(profile["preferred_merchants"]) > 10:
            insights.append({
                "insight_id": f"diversity_{customer_id}_{int(time.time())}",
                "type": "merchant_diversity",
                "customer_id": customer_id,
                "message": f"High merchant diversity: {len(profile['preferred_merchants'])} categories",
                "severity": "low",
                "timestamp": datetime.utcnow().isoformat()
            })
        
        return insights
    
    async def _broadcast_fraud_alert(self, alert: Dict[str, Any]):
        """Broadcast critical fraud alerts"""
        
        try:
            await websocket_manager.broadcast_system_event(
                event_type=websocket_manager.EventType.SYSTEM_ALERT,
                data={
                    "alert_type": "fraud_detection",
                    "alert": alert
                }
            )
        except Exception as e:
            logger.error(f"Failed to broadcast fraud alert: {e}")

class ECommerceEventConsumer:
    """Consumer for e-commerce event streams"""
    
    def __init__(self):
        self.user_sessions = {}
        self.product_analytics = defaultdict(lambda: {
            "views": 0, "cart_adds": 0, "purchases": 0, "conversion_rate": 0.0
        })
        
    async def process_ecommerce_event(self, message: StreamMessage) -> ProcessingResult:
        """Process e-commerce events and generate insights"""
        
        start_time = time.time()
        insights = []
        alerts = []
        errors = []
        
        try:
            data = message.data
            event_id = data.get("event_id")
            user_id = data.get("user_id")
            session_id = data.get("session_id")
            product_id = data.get("product_id")
            
            if not all([event_id, user_id, session_id]):
                errors.append("Missing required event fields")
                return ProcessingResult(
                    success=False,
                    message_id=message.id,
                    processing_time=time.time() - start_time,
                    insights=insights,
                    alerts=alerts,
                    errors=errors,
                    metadata={"event_id": event_id}
                )
            
            # Update user session
            await self._update_user_session(session_id, data)
            
            # Update product analytics
            if product_id:
                await self._update_product_analytics(product_id, message.event_type)
            
            # Generate user behavior insights
            behavior_insights = await self._analyze_user_behavior(session_id, data)
            insights.extend(behavior_insights)
            
            # Generate product performance insights
            if product_id:
                product_insights = await self._analyze_product_performance(product_id)
                insights.extend(product_insights)
            
            # Check for anomalous behavior
            anomaly_alerts = await self._detect_anomalous_behavior(session_id, data)
            alerts.extend(anomaly_alerts)
            
            processing_time = time.time() - start_time
            
            return ProcessingResult(
                success=True,
                message_id=message.id,
                processing_time=processing_time,
                insights=insights,
                alerts=alerts,
                errors=errors,
                metadata={
                    "event_id": event_id,
                    "user_id": user_id,
                    "session_id": session_id,
                    "product_id": product_id
                }
            )
            
        except Exception as e:
            errors.append(f"Error processing e-commerce event: {str(e)}")
            logger.error(f"Error processing e-commerce event {message.id}: {e}")
            
            return ProcessingResult(
                success=False,
                message_id=message.id,
                processing_time=time.time() - start_time,
                insights=insights,
                alerts=alerts,
                errors=errors,
                metadata={}
            )
    
    async def _update_user_session(self, session_id: str, event_data: Dict[str, Any]):
        """Update user session data"""
        
        if session_id not in self.user_sessions:
            self.user_sessions[session_id] = {
                "user_id": event_data.get("user_id"),
                "start_time": datetime.utcnow(),
                "events": [],
                "products_viewed": set(),
                "cart_items": set(),
                "total_time": 0,
                "page_views": 0
            }
        
        session = self.user_sessions[session_id]
        session["events"].append({
            "timestamp": datetime.utcnow(),
            "event_type": event_data.get("event_type", "unknown"),
            "product_id": event_data.get("product_id")
        })
        
        # Update session metrics
        if event_data.get("product_id"):
            if "view" in event_data.get("event_type", "").lower():
                session["products_viewed"].add(event_data["product_id"])
            elif "cart" in event_data.get("event_type", "").lower():
                session["cart_items"].add(event_data["product_id"])
        
        session["page_views"] += 1
        session["total_time"] = (datetime.utcnow() - session["start_time"]).seconds
    
    async def _update_product_analytics(self, product_id: str, event_type: EventType):
        """Update product performance analytics"""
        
        analytics = self.product_analytics[product_id]
        
        if event_type == EventType.USER_VIEW:
            analytics["views"] += 1
        elif event_type == EventType.ADD_TO_CART:
            analytics["cart_adds"] += 1
        elif event_type == EventType.PURCHASE:
            analytics["purchases"] += 1
        
        # Update conversion rate
        if analytics["views"] > 0:
            analytics["conversion_rate"] = analytics["purchases"] / analytics["views"]
    
    async def _analyze_user_behavior(self, session_id: str, event_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Analyze user behavior patterns"""
        
        insights = []
        session = self.user_sessions.get(session_id)
        
        if not session or len(session["events"]) < 5:
            return insights
        
        # High engagement detection
        if session["page_views"] > 20:
            insights.append({
                "insight_id": f"engagement_{session_id}_{int(time.time())}",
                "type": "high_engagement",
                "session_id": session_id,
                "message": f"High engagement session: {session['page_views']} page views",
                "severity": "low",
                "timestamp": datetime.utcnow().isoformat()
            })
        
        # Cart abandonment risk
        if len(session["cart_items"]) > 0 and session["page_views"] > 10:
            recent_events = session["events"][-5:]
            if not any("purchase" in event["event_type"] for event in recent_events):
                insights.append({
                    "insight_id": f"abandonment_{session_id}_{int(time.time())}",
                    "type": "cart_abandonment_risk",
                    "session_id": session_id,
                    "message": f"Potential cart abandonment: {len(session['cart_items'])} items in cart",
                    "cart_items": list(session["cart_items"]),
                    "severity": "medium",
                    "timestamp": datetime.utcnow().isoformat()
                })
        
        return insights
    
    async def _analyze_product_performance(self, product_id: str) -> List[Dict[str, Any]]:
        """Analyze product performance"""
        
        insights = []
        analytics = self.product_analytics[product_id]
        
        if analytics["views"] < 10:  # Not enough data
            return insights
        
        # High conversion rate products
        if analytics["conversion_rate"] > 0.1:  # 10% conversion rate
            insights.append({
                "insight_id": f"performance_{product_id}_{int(time.time())}",
                "type": "high_conversion_product",
                "product_id": product_id,
                "message": f"High-converting product: {analytics['conversion_rate']:.2%} conversion rate",
                "conversion_rate": analytics["conversion_rate"],
                "severity": "low",
                "timestamp": datetime.utcnow().isoformat()
            })
        
        # Low conversion rate products
        elif analytics["conversion_rate"] < 0.01 and analytics["views"] > 50:  # 1% conversion with many views
            insights.append({
                "insight_id": f"performance_{product_id}_{int(time.time())}",
                "type": "low_conversion_product",
                "product_id": product_id,
                "message": f"Low-converting product: {analytics['conversion_rate']:.2%} conversion rate with {analytics['views']} views",
                "conversion_rate": analytics["conversion_rate"],
                "views": analytics["views"],
                "severity": "medium",
                "timestamp": datetime.utcnow().isoformat()
            })
        
        return insights
    
    async def _detect_anomalous_behavior(self, session_id: str, event_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Detect anomalous user behavior"""
        
        alerts = []
        session = self.user_sessions.get(session_id)
        
        if not session:
            return alerts
        
        # Rapid-fire events (potential bot behavior)
        if len(session["events"]) >= 20 and session["total_time"] < 60:  # 20 events in under 1 minute
            alerts.append({
                "alert_id": f"bot_{session_id}_{int(time.time())}",
                "session_id": session_id,
                "level": "warning",
                "message": f"Potential bot behavior: {len(session['events'])} events in {session['total_time']} seconds",
                "recommended_actions": ["Implement CAPTCHA", "Rate limit user", "Monitor session"],
                "timestamp": datetime.utcnow().isoformat()
            })
        
        return alerts

class StreamConsumerOrchestrator:
    """Orchestrates all stream consumers"""
    
    def __init__(self):
        self.consumers = {}
        self.consumer_tasks = {}
        self.processing_stats = defaultdict(lambda: {"processed": 0, "failed": 0, "avg_time": 0.0})
        
    async def start_all_consumers(self):
        """Start all stream consumers"""
        
        streams_client = await get_streams_client()
        
        # Initialize consumers
        iot_consumer = IoTSensorConsumer()
        financial_consumer = FinancialTransactionConsumer()
        ecommerce_consumer = ECommerceEventConsumer()
        
        # Configure consumer configs
        consumer_configs = [
            (
                ConsumerConfig(
                    consumer_group="iot_processing",
                    consumer_name="iot_consumer_1",
                    stream_name=StreamType.IOT_SENSORS.value,
                    batch_size=5,
                    max_retries=3
                ),
                iot_consumer.process_sensor_reading
            ),
            (
                ConsumerConfig(
                    consumer_group="financial_processing",
                    consumer_name="financial_consumer_1",
                    stream_name=StreamType.FINANCIAL_TRANSACTIONS.value,
                    batch_size=10,
                    max_retries=3
                ),
                financial_consumer.process_transaction
            ),
            (
                ConsumerConfig(
                    consumer_group="ecommerce_processing",
                    consumer_name="ecommerce_consumer_1",
                    stream_name=StreamType.ECOMMERCE_EVENTS.value,
                    batch_size=20,
                    max_retries=2
                ),
                ecommerce_consumer.process_ecommerce_event
            )
        ]
        
        # Start consumers
        tasks = []
        for config, handler in consumer_configs:
            # Wrap handler to collect stats
            wrapped_handler = self._create_stats_wrapper(config.stream_name, handler)
            
            # Start consumer
            await streams_client.consume_messages(config, wrapped_handler)
            
            logger.info(f"Started consumer {config.consumer_name} for stream {config.stream_name}")
        
        logger.info("All stream consumers started successfully")
    
    def _create_stats_wrapper(self, stream_name: str, handler: Callable) -> Callable:
        """Create a wrapper to collect processing statistics"""
        
        async def wrapped_handler(message: StreamMessage) -> Any:
            try:
                result = await handler(message)
                
                # Update stats
                stats = self.processing_stats[stream_name]
                stats["processed"] += 1
                
                if hasattr(result, 'processing_time'):
                    # Update rolling average processing time
                    current_avg = stats["avg_time"]
                    count = stats["processed"]
                    stats["avg_time"] = (current_avg * (count - 1) + result.processing_time) / count
                
                if hasattr(result, 'success') and not result.success:
                    stats["failed"] += 1
                
                return result
                
            except Exception as e:
                stats = self.processing_stats[stream_name]
                stats["failed"] += 1
                logger.error(f"Error in stream consumer for {stream_name}: {e}")
                raise
        
        return wrapped_handler
    
    def get_consumer_stats(self) -> Dict[str, Any]:
        """Get consumer processing statistics"""
        
        stats = {}
        for stream_name, stream_stats in self.processing_stats.items():
            total = stream_stats["processed"] + stream_stats["failed"]
            success_rate = stream_stats["processed"] / total if total > 0 else 0
            
            stats[stream_name] = {
                "processed": stream_stats["processed"],
                "failed": stream_stats["failed"],
                "success_rate": success_rate,
                "avg_processing_time": stream_stats["avg_time"]
            }
        
        return stats

# Global orchestrator instance
consumer_orchestrator = StreamConsumerOrchestrator()

async def start_stream_consumers():
    """Start all stream consumers"""
    await consumer_orchestrator.start_all_consumers()

def get_stream_consumer_stats() -> Dict[str, Any]:
    """Get stream consumer statistics"""
    return consumer_orchestrator.get_consumer_stats()