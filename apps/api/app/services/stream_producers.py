"""
Stream Producer Services for Real-Time Data Generation
======================================================

Comprehensive stream producers for generating realistic real-time data:
- IoT sensor data streams (temperature, pressure, vibration, etc.)
- Financial transaction streams (payments, fraud detection, risk scoring)
- E-commerce event streams (user behavior, recommendations, inventory)

These producers generate realistic data patterns for demonstration and testing
of the real-time streaming system capabilities.
"""

import asyncio
import json
import logging
import random
import time
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from enum import Enum

from app.core.redis_streams import get_streams_client, EventType, StreamType

logger = logging.getLogger(__name__)

class IoTSensorType(Enum):
    """Types of IoT sensors"""
    TEMPERATURE = "temperature"
    PRESSURE = "pressure"
    VIBRATION = "vibration"
    HUMIDITY = "humidity"
    LIGHT = "light"
    MOTION = "motion"
    AIR_QUALITY = "air_quality"

class TransactionType(Enum):
    """Types of financial transactions"""
    PAYMENT = "payment"
    TRANSFER = "transfer"
    DEPOSIT = "deposit"
    WITHDRAWAL = "withdrawal"
    REFUND = "refund"

class ECommerceEventType(Enum):
    """Types of e-commerce events"""
    PAGE_VIEW = "page_view"
    PRODUCT_VIEW = "product_view"
    ADD_TO_CART = "add_to_cart"
    REMOVE_FROM_CART = "remove_from_cart"
    CHECKOUT_START = "checkout_start"
    PURCHASE_COMPLETE = "purchase_complete"
    SEARCH = "search"
    RECOMMENDATION_SHOWN = "recommendation_shown"
    RECOMMENDATION_CLICKED = "recommendation_clicked"

@dataclass
class StreamProducerConfig:
    """Configuration for stream producers"""
    enabled: bool = True
    rate_per_second: float = 10.0
    burst_probability: float = 0.1  # Probability of burst events
    burst_multiplier: int = 5
    anomaly_probability: float = 0.05  # Probability of anomalous data
    jitter: float = 0.2  # Random variation in timing

class IoTStreamProducer:
    """Producer for IoT sensor data streams"""
    
    def __init__(self, name: str = "iot_producer", config: StreamProducerConfig = None):
        self.name = name
        # Handle both dict and StreamProducerConfig objects
        if isinstance(config, dict):
            self.config = StreamProducerConfig(**config)
        else:
            self.config = config or StreamProducerConfig()
        self.running = False
        self.sensors = self._initialize_sensors()
        
    def _initialize_sensors(self) -> List[Dict[str, Any]]:
        """Initialize virtual IoT sensors with realistic configurations"""
        
        sensors = []
        
        # Manufacturing floor sensors
        for i in range(10):
            sensors.append({
                "sensor_id": f"temp_sensor_{i:03d}",
                "type": IoTSensorType.TEMPERATURE,
                "location": f"Factory_Floor_Zone_{i}",
                "normal_range": (18.0, 25.0),
                "critical_threshold": 30.0,
                "unit": "°C"
            })
        
        for i in range(8):
            sensors.append({
                "sensor_id": f"pressure_sensor_{i:03d}",
                "type": IoTSensorType.PRESSURE,
                "location": f"Pipeline_Section_{i}",
                "normal_range": (95.0, 105.0),
                "critical_threshold": 110.0,
                "unit": "PSI"
            })
        
        for i in range(12):
            sensors.append({
                "sensor_id": f"vibration_sensor_{i:03d}",
                "type": IoTSensorType.VIBRATION,
                "location": f"Motor_Unit_{i}",
                "normal_range": (0.1, 2.0),
                "critical_threshold": 5.0,
                "unit": "mm/s"
            })
        
        # Environmental sensors
        for i in range(6):
            sensors.append({
                "sensor_id": f"humidity_sensor_{i:03d}",
                "type": IoTSensorType.HUMIDITY,
                "location": f"Storage_Room_{i}",
                "normal_range": (40.0, 60.0),
                "critical_threshold": 80.0,
                "unit": "%RH"
            })
        
        return sensors
    
    async def start_streaming(self):
        """Start generating IoT sensor data streams"""
        
        if not self.config.enabled:
            return
            
        self.running = True
        logger.info(f"Starting IoT stream producer with {len(self.sensors)} sensors")
        
        # Start producer tasks for each sensor type
        tasks = []
        
        for sensor in self.sensors:
            task = asyncio.create_task(self._produce_sensor_data(sensor))
            tasks.append(task)
        
        try:
            await asyncio.gather(*tasks)
        except asyncio.CancelledError:
            logger.info("IoT stream producer cancelled")
        except Exception as e:
            logger.error(f"Error in IoT stream producer: {e}")
        finally:
            self.running = False
    
    async def generate_sensor_data(self) -> Dict[str, Any]:
        """Generate sensor data for testing purposes"""
        if not self.sensors:
            return {}
        
        import random
        sensor = random.choice(self.sensors)
        return self._generate_sensor_reading(sensor)
    
    async def _produce_sensor_data(self, sensor: Dict[str, Any]):
        """Generate realistic sensor data for a specific sensor"""
        
        streams_client = await get_streams_client()
        sensor_id = sensor["sensor_id"]
        sensor_type = sensor["type"]
        
        while self.running:
            try:
                # Calculate sleep time with jitter
                base_interval = 1.0 / self.config.rate_per_second
                jitter = random.uniform(-self.config.jitter, self.config.jitter)
                sleep_time = max(0.1, base_interval + jitter)
                
                # Check for burst events
                is_burst = random.random() < self.config.burst_probability
                num_readings = self.config.burst_multiplier if is_burst else 1
                
                for _ in range(num_readings):
                    # Generate sensor reading
                    reading_data = self._generate_sensor_reading(sensor)
                    
                    # Produce to stream
                    await streams_client.produce_message(
                        stream_name=StreamType.IOT_SENSORS.value,
                        event_type=EventType.SENSOR_READING,
                        data=reading_data,
                        source=f"iot_producer_{sensor_id}",
                        correlation_id=str(uuid.uuid4())
                    )
                
                await asyncio.sleep(sleep_time)
                
            except Exception as e:
                logger.error(f"Error producing sensor data for {sensor_id}: {e}")
                await asyncio.sleep(5)
    
    def _generate_sensor_reading(self, sensor: Dict[str, Any]) -> Dict[str, Any]:
        """Generate a realistic sensor reading"""
        
        sensor_type = sensor["type"]
        normal_range = sensor["normal_range"]
        critical_threshold = sensor["critical_threshold"]
        
        # Determine if this should be an anomaly
        is_anomaly = random.random() < self.config.anomaly_probability
        
        if is_anomaly:
            # Generate anomalous value
            if random.random() < 0.5:
                # Above normal range
                value = random.uniform(critical_threshold * 0.9, critical_threshold * 1.2)
            else:
                # Below normal range (for applicable sensors)
                value = random.uniform(0, normal_range[0] * 0.5)
        else:
            # Generate normal value with some variation
            mid_point = (normal_range[0] + normal_range[1]) / 2
            variation = (normal_range[1] - normal_range[0]) * 0.3
            value = random.gauss(mid_point, variation)
            value = max(normal_range[0] * 0.8, min(normal_range[1] * 1.2, value))
        
        # Add sensor-specific adjustments
        value = round(value, 2)
        
        # Determine alert level
        alert_level = "normal"
        if value > critical_threshold:
            alert_level = "critical"
        elif value > normal_range[1]:
            alert_level = "warning"
        elif value < normal_range[0] * 0.8:
            alert_level = "low"
        
        return {
            "sensor_id": sensor["sensor_id"],
            "sensor_type": sensor_type.value,
            "location": sensor["location"],
            "value": value,
            "unit": sensor["unit"],
            "timestamp": datetime.utcnow().isoformat(),
            "alert_level": alert_level,
            "is_anomaly": is_anomaly,
            "normal_range": normal_range,
            "critical_threshold": critical_threshold
        }

class FinancialStreamProducer:
    """Producer for financial transaction streams"""
    
    def __init__(self, config: StreamProducerConfig = None):
        self.config = config or StreamProducerConfig(rate_per_second=50.0)
        self.running = False
        self.merchants = self._initialize_merchants()
        self.customers = self._initialize_customers()
        
    def _initialize_merchants(self) -> List[Dict[str, Any]]:
        """Initialize merchant profiles"""
        
        merchant_types = [
            {"category": "retail", "risk_level": "low", "avg_transaction": 45.0},
            {"category": "restaurant", "risk_level": "low", "avg_transaction": 25.0},
            {"category": "gas_station", "risk_level": "medium", "avg_transaction": 60.0},
            {"category": "online", "risk_level": "medium", "avg_transaction": 85.0},
            {"category": "cash_advance", "risk_level": "high", "avg_transaction": 300.0},
            {"category": "gambling", "risk_level": "high", "avg_transaction": 150.0}
        ]
        
        merchants = []
        for i in range(100):
            merchant_type = random.choice(merchant_types)
            merchants.append({
                "merchant_id": f"merchant_{i:04d}",
                "name": f"Merchant {i}",
                "category": merchant_type["category"],
                "risk_level": merchant_type["risk_level"],
                "avg_transaction": merchant_type["avg_transaction"],
                "location": f"City_{random.randint(1, 50)}"
            })
        
        return merchants
    
    def _initialize_customers(self) -> List[Dict[str, Any]]:
        """Initialize customer profiles"""
        
        customers = []
        for i in range(1000):
            customers.append({
                "customer_id": f"customer_{i:06d}",
                "risk_score": random.uniform(0.1, 0.9),
                "avg_monthly_spend": random.uniform(500, 5000),
                "preferred_categories": random.sample([
                    "retail", "restaurant", "gas_station", "online", "grocery"
                ], k=random.randint(2, 4)),
                "location": f"City_{random.randint(1, 50)}"
            })
        
        return customers
    
    async def start_streaming(self):
        """Start generating financial transaction streams"""
        
        if not self.config.enabled:
            return
            
        self.running = True
        logger.info("Starting financial transaction stream producer")
        
        try:
            await self._produce_transactions()
        except asyncio.CancelledError:
            logger.info("Financial stream producer cancelled")
        except Exception as e:
            logger.error(f"Error in financial stream producer: {e}")
        finally:
            self.running = False
    
    async def _produce_transactions(self):
        """Generate realistic financial transactions"""
        
        streams_client = await get_streams_client()
        
        while self.running:
            try:
                # Calculate sleep time
                base_interval = 1.0 / self.config.rate_per_second
                jitter = random.uniform(-self.config.jitter, self.config.jitter)
                sleep_time = max(0.01, base_interval + jitter)
                
                # Check for burst events (peak shopping times)
                is_burst = random.random() < self.config.burst_probability
                num_transactions = self.config.burst_multiplier if is_burst else 1
                
                for _ in range(num_transactions):
                    # Generate transaction
                    transaction_data = self._generate_transaction()
                    
                    # Produce transaction event
                    await streams_client.produce_message(
                        stream_name=StreamType.FINANCIAL_TRANSACTIONS.value,
                        event_type=EventType.TRANSACTION,
                        data=transaction_data,
                        source="financial_producer",
                        correlation_id=transaction_data["transaction_id"]
                    )
                    
                    # Check for fraud and generate fraud event if needed
                    if transaction_data["fraud_score"] > 0.8:
                        await streams_client.produce_message(
                            stream_name=StreamType.FINANCIAL_TRANSACTIONS.value,
                            event_type=EventType.FRAUD_DETECTED,
                            data={
                                "transaction_id": transaction_data["transaction_id"],
                                "fraud_score": transaction_data["fraud_score"],
                                "fraud_reasons": transaction_data.get("fraud_indicators", []),
                                "customer_id": transaction_data["customer_id"],
                                "amount": transaction_data["amount"]
                            },
                            source="fraud_detection_system",
                            correlation_id=transaction_data["transaction_id"]
                        )
                
                await asyncio.sleep(sleep_time)
                
            except Exception as e:
                logger.error(f"Error producing financial transaction: {e}")
                await asyncio.sleep(1)
    
    def _generate_transaction(self) -> Dict[str, Any]:
        """Generate a realistic financial transaction"""
        
        customer = random.choice(self.customers)
        merchant = random.choice(self.merchants)
        transaction_type = random.choice(list(TransactionType))
        
        # Base amount based on merchant type
        base_amount = merchant["avg_transaction"]
        amount = max(1.0, random.gauss(base_amount, base_amount * 0.5))
        amount = round(amount, 2)
        
        # Calculate fraud score
        fraud_score = self._calculate_fraud_score(customer, merchant, amount)
        
        # Determine if transaction is anomalous
        is_anomaly = (
            amount > customer["avg_monthly_spend"] * 0.5 or  # Large amount
            merchant["category"] not in customer["preferred_categories"] or  # Unusual category
            fraud_score > 0.7  # High fraud score
        )
        
        # Generate fraud indicators if applicable
        fraud_indicators = []
        if fraud_score > 0.5:
            if amount > customer["avg_monthly_spend"] * 0.3:
                fraud_indicators.append("unusual_amount")
            if merchant["category"] not in customer["preferred_categories"]:
                fraud_indicators.append("unusual_merchant_category")
            if customer["location"] != merchant["location"]:
                fraud_indicators.append("location_mismatch")
            if merchant["risk_level"] == "high":
                fraud_indicators.append("high_risk_merchant")
        
        return {
            "transaction_id": str(uuid.uuid4()),
            "customer_id": customer["customer_id"],
            "merchant_id": merchant["merchant_id"],
            "merchant_name": merchant["name"],
            "merchant_category": merchant["category"],
            "transaction_type": transaction_type.value,
            "amount": amount,
            "currency": "USD",
            "timestamp": datetime.utcnow().isoformat(),
            "customer_location": customer["location"],
            "merchant_location": merchant["location"],
            "fraud_score": round(fraud_score, 3),
            "fraud_indicators": fraud_indicators,
            "is_anomaly": is_anomaly,
            "risk_level": merchant["risk_level"]
        }
    
    def _calculate_fraud_score(self, customer: Dict, merchant: Dict, amount: float) -> float:
        """Calculate fraud score based on various factors"""
        
        score = 0.0
        
        # Base customer risk
        score += customer["risk_score"] * 0.3
        
        # Merchant risk
        if merchant["risk_level"] == "high":
            score += 0.3
        elif merchant["risk_level"] == "medium":
            score += 0.1
        
        # Amount risk
        if amount > customer["avg_monthly_spend"] * 0.5:
            score += 0.3
        elif amount > customer["avg_monthly_spend"] * 0.2:
            score += 0.1
        
        # Category risk
        if merchant["category"] not in customer["preferred_categories"]:
            score += 0.2
        
        # Location risk
        if customer["location"] != merchant["location"]:
            score += 0.1
        
        # Add some randomness
        score += random.uniform(-0.1, 0.1)
        
        return max(0.0, min(1.0, score))

class ECommerceStreamProducer:
    """Producer for e-commerce event streams"""
    
    def __init__(self, config: StreamProducerConfig = None):
        self.config = config or StreamProducerConfig(rate_per_second=100.0)
        self.running = False
        self.products = self._initialize_products()
        self.users = self._initialize_users()
        
    def _initialize_products(self) -> List[Dict[str, Any]]:
        """Initialize product catalog"""
        
        categories = [
            {"name": "Electronics", "price_range": (50, 2000), "popularity": 0.8},
            {"name": "Clothing", "price_range": (20, 300), "popularity": 0.9},
            {"name": "Books", "price_range": (10, 100), "popularity": 0.6},
            {"name": "Home", "price_range": (25, 500), "popularity": 0.7},
            {"name": "Sports", "price_range": (30, 800), "popularity": 0.5},
            {"name": "Beauty", "price_range": (15, 200), "popularity": 0.8}
        ]
        
        products = []
        for i in range(500):
            category = random.choice(categories)
            price = random.uniform(*category["price_range"])
            
            products.append({
                "product_id": f"product_{i:05d}",
                "name": f"Product {i}",
                "category": category["name"],
                "price": round(price, 2),
                "popularity_score": category["popularity"] + random.uniform(-0.2, 0.2),
                "inventory_level": random.randint(0, 1000),
                "rating": round(random.uniform(3.0, 5.0), 1)
            })
        
        return products
    
    def _initialize_users(self) -> List[Dict[str, Any]]:
        """Initialize user profiles"""
        
        users = []
        for i in range(2000):
            users.append({
                "user_id": f"user_{i:06d}",
                "session_id": str(uuid.uuid4()),
                "user_segment": random.choice(["new", "returning", "premium", "casual"]),
                "preferred_categories": random.sample([
                    "Electronics", "Clothing", "Books", "Home", "Sports", "Beauty"
                ], k=random.randint(1, 3)),
                "avg_order_value": random.uniform(30, 500),
                "conversion_rate": random.uniform(0.05, 0.3)
            })
        
        return users
    
    async def start_streaming(self):
        """Start generating e-commerce event streams"""
        
        if not self.config.enabled:
            return
            
        self.running = True
        logger.info("Starting e-commerce event stream producer")
        
        try:
            await self._produce_events()
        except asyncio.CancelledError:
            logger.info("E-commerce stream producer cancelled")
        except Exception as e:
            logger.error(f"Error in e-commerce stream producer: {e}")
        finally:
            self.running = False
    
    async def _produce_events(self):
        """Generate realistic e-commerce events"""
        
        streams_client = await get_streams_client()
        
        while self.running:
            try:
                # Calculate sleep time
                base_interval = 1.0 / self.config.rate_per_second
                jitter = random.uniform(-self.config.jitter, self.config.jitter)
                sleep_time = max(0.01, base_interval + jitter)
                
                # Check for burst events (peak shopping periods)
                is_burst = random.random() < self.config.burst_probability
                num_events = self.config.burst_multiplier if is_burst else 1
                
                for _ in range(num_events):
                    # Generate event
                    event_data = self._generate_ecommerce_event()
                    
                    # Determine event type based on probabilities
                    event_type = self._determine_event_type()
                    
                    # Produce event
                    await streams_client.produce_message(
                        stream_name=StreamType.ECOMMERCE_EVENTS.value,
                        event_type=self._map_to_event_type(event_type),
                        data=event_data,
                        source="ecommerce_producer",
                        correlation_id=event_data["session_id"]
                    )
                
                await asyncio.sleep(sleep_time)
                
            except Exception as e:
                logger.error(f"Error producing e-commerce event: {e}")
                await asyncio.sleep(1)
    
    def _determine_event_type(self) -> ECommerceEventType:
        """Determine event type based on realistic probabilities"""
        
        # Weighted probabilities for different events
        events_weights = [
            (ECommerceEventType.PAGE_VIEW, 0.4),
            (ECommerceEventType.PRODUCT_VIEW, 0.25),
            (ECommerceEventType.SEARCH, 0.15),
            (ECommerceEventType.ADD_TO_CART, 0.08),
            (ECommerceEventType.RECOMMENDATION_SHOWN, 0.05),
            (ECommerceEventType.CHECKOUT_START, 0.03),
            (ECommerceEventType.PURCHASE_COMPLETE, 0.02),
            (ECommerceEventType.RECOMMENDATION_CLICKED, 0.01),
            (ECommerceEventType.REMOVE_FROM_CART, 0.01)
        ]
        
        rand = random.random()
        cumulative = 0.0
        
        for event_type, weight in events_weights:
            cumulative += weight
            if rand <= cumulative:
                return event_type
        
        return ECommerceEventType.PAGE_VIEW
    
    def _generate_ecommerce_event(self) -> Dict[str, Any]:
        """Generate a realistic e-commerce event"""
        
        user = random.choice(self.users)
        
        # Select product based on user preferences if applicable
        preferred_products = [
            p for p in self.products 
            if p["category"] in user["preferred_categories"]
        ]
        
        if preferred_products and random.random() < 0.7:  # 70% chance to view preferred category
            product = random.choice(preferred_products)
        else:
            product = random.choice(self.products)
        
        return {
            "event_id": str(uuid.uuid4()),
            "user_id": user["user_id"],
            "session_id": user["session_id"],
            "user_segment": user["user_segment"],
            "product_id": product["product_id"],
            "product_name": product["name"],
            "product_category": product["category"],
            "product_price": product["price"],
            "product_rating": product["rating"],
            "timestamp": datetime.utcnow().isoformat(),
            "page_url": f"/products/{product['product_id']}",
            "referrer": random.choice([
                "google.com", "facebook.com", "direct", "email", "banner_ad"
            ]),
            "device_type": random.choice(["desktop", "mobile", "tablet"]),
            "user_agent": "MockUserAgent/1.0",
            "ip_address": f"192.168.{random.randint(1,255)}.{random.randint(1,255)}"
        }
    
    def _map_to_event_type(self, ecommerce_event_type: ECommerceEventType) -> EventType:
        """Map e-commerce event types to stream event types"""
        
        mapping = {
            ECommerceEventType.PAGE_VIEW: EventType.USER_VIEW,
            ECommerceEventType.PRODUCT_VIEW: EventType.USER_VIEW,
            ECommerceEventType.ADD_TO_CART: EventType.ADD_TO_CART,
            ECommerceEventType.REMOVE_FROM_CART: EventType.ADD_TO_CART,
            ECommerceEventType.CHECKOUT_START: EventType.PURCHASE,
            ECommerceEventType.PURCHASE_COMPLETE: EventType.PURCHASE,
            ECommerceEventType.SEARCH: EventType.USER_VIEW,
            ECommerceEventType.RECOMMENDATION_SHOWN: EventType.RECOMMENDATION,
            ECommerceEventType.RECOMMENDATION_CLICKED: EventType.RECOMMENDATION
        }
        
        return mapping.get(ecommerce_event_type, EventType.USER_VIEW)

class StreamProducerOrchestrator:
    """Orchestrates all stream producers"""
    
    def __init__(self):
        self.producers = {}
        self.running = False
        
    def configure_producers(self, config: Dict[str, StreamProducerConfig]):
        """Configure all stream producers"""
        
        self.producers = {
            "iot": IoTStreamProducer(config.get("iot", StreamProducerConfig())),
            "financial": FinancialStreamProducer(config.get("financial", StreamProducerConfig())),
            "ecommerce": ECommerceStreamProducer(config.get("ecommerce", StreamProducerConfig()))
        }
        
    async def start_all_producers(self):
        """Start all configured producers"""
        
        if not self.producers:
            logger.warning("No producers configured")
            return
            
        self.running = True
        logger.info("Starting all stream producers")
        
        tasks = []
        
        for name, producer in self.producers.items():
            if hasattr(producer.config, 'enabled') and producer.config.enabled:
                logger.info(f"Starting {name} producer")
                task = asyncio.create_task(producer.start_streaming())
                tasks.append(task)
        
        try:
            await asyncio.gather(*tasks)
        except asyncio.CancelledError:
            logger.info("All stream producers cancelled")
        except Exception as e:
            logger.error(f"Error in stream producer orchestrator: {e}")
        finally:
            self.running = False
    
    def stop_all_producers(self):
        """Stop all producers"""
        
        self.running = False
        
        for producer in self.producers.values():
            producer.running = False
            
        logger.info("All stream producers stopped")

# Global orchestrator instance
stream_orchestrator = StreamProducerOrchestrator()

async def start_stream_producers(config: Dict[str, Any] = None):
    """Start stream producers with optional configuration"""
    
    if config is None:
        config = {
            "iot": StreamProducerConfig(enabled=True, rate_per_second=5.0),
            "financial": StreamProducerConfig(enabled=True, rate_per_second=20.0),
            "ecommerce": StreamProducerConfig(enabled=True, rate_per_second=50.0)
        }
    
    stream_orchestrator.configure_producers(config)
    await stream_orchestrator.start_all_producers()

def stop_stream_producers():
    """Stop all stream producers"""
    stream_orchestrator.stop_all_producers()