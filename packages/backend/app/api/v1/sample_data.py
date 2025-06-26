"""
Sample Data API Endpoint
Provides pre-built datasets for users to explore Pollarbase features
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import uuid
import json
import csv
import io
from datetime import datetime, timedelta
import random

from app.database.connection import get_db
from app.database.models import DataInvestigation, User
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/sample-data", tags=["sample-data"])

# Sample datasets
SAMPLE_DATASETS = {
    "customer_demographics": {
        "name": "Customer Demographics Sample",
        "description": "1,000 customer records with demographics and behavior data",
        "file_name": "customer_demographics.csv",
        "records": 1000,
        "columns": ["customer_id", "name", "email", "age", "gender", "city", "signup_date", "last_purchase", "total_spent", "subscription_status"],
        "category": "business",
        "use_cases": ["Customer segmentation", "Marketing analysis", "Churn prediction"]
    },
    "sales_transactions": {
        "name": "E-commerce Sales Transactions",
        "description": "5,000 sales transaction records from an online store",
        "file_name": "sales_transactions.csv", 
        "records": 5000,
        "columns": ["transaction_id", "customer_id", "product_id", "product_name", "category", "price", "quantity", "total", "payment_method", "transaction_date", "shipping_address"],
        "category": "e-commerce",
        "use_cases": ["Sales analysis", "Product performance", "Revenue forecasting"]
    },
    "sensor_readings": {
        "name": "IoT Sensor Readings",
        "description": "2,500 time-series sensor readings from smart devices",
        "file_name": "sensor_readings.csv",
        "records": 2500,
        "columns": ["sensor_id", "timestamp", "temperature", "humidity", "pressure", "battery_level", "location", "device_type", "status", "alert_level"],
        "category": "iot",
        "use_cases": ["Anomaly detection", "Predictive maintenance", "Environmental monitoring"]
    },
    "employee_data": {
        "name": "HR Employee Dataset",
        "description": "800 employee records with performance and satisfaction metrics",
        "file_name": "employee_data.csv",
        "records": 800,
        "columns": ["employee_id", "name", "department", "position", "hire_date", "salary", "performance_score", "satisfaction_rating", "projects_completed", "training_hours"],
        "category": "hr",
        "use_cases": ["Performance analysis", "Salary benchmarking", "Employee retention"]
    },
    "financial_transactions": {
        "name": "Banking Transactions",
        "description": "3,000 anonymized banking transaction records",
        "file_name": "financial_transactions.csv",
        "records": 3000,
        "columns": ["transaction_id", "account_id", "transaction_type", "amount", "balance_after", "merchant", "category", "timestamp", "location", "card_type"],
        "category": "finance",
        "use_cases": ["Fraud detection", "Spending analysis", "Cash flow forecasting"]
    }
}

def generate_customer_demographics(num_records: int = 1000) -> List[Dict[str, Any]]:
    """Generate sample customer demographics data"""
    cities = ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix"]
    subscription_statuses = ["active", "inactive", "trial", "cancelled", "premium"]
    
    data = []
    for i in range(num_records):
        signup_date = datetime.now() - timedelta(days=random.randint(1, 730))
        last_purchase = signup_date + timedelta(days=random.randint(0, 365))
        
        record = {
            "customer_id": f"CUST_{i+1:05d}",
            "name": f"Customer {i+1}",
            "email": f"customer{i+1}@example.com",
            "age": random.randint(18, 75) if random.random() > 0.05 else None,
            "gender": random.choice(["Male", "Female", "Other"]),
            "city": random.choice(cities),
            "signup_date": signup_date.strftime('%Y-%m-%d'),
            "last_purchase": last_purchase.strftime('%Y-%m-%d') if random.random() > 0.1 else None,
            "total_spent": round(random.uniform(0, 5000), 2),
            "subscription_status": random.choice(subscription_statuses)
        }
        data.append(record)
    
    return data

def generate_sales_transactions(num_records: int = 5000) -> List[Dict[str, Any]]:
    """Generate sample sales transaction data"""
    products = [
        ("Laptop", "Electronics", 999.99),
        ("Smartphone", "Electronics", 699.99),
        ("Coffee Maker", "Home & Kitchen", 89.99),
        ("Running Shoes", "Sports", 129.99),
        ("Wireless Headphones", "Electronics", 199.99),
        ("Yoga Mat", "Sports", 39.99),
        ("Cookbook", "Books", 24.99),
        ("Gaming Mouse", "Electronics", 79.99),
        ("Water Bottle", "Sports", 19.99),
        ("Desk Chair", "Furniture", 299.99)
    ]
    payment_methods = ["credit_card", "debit_card", "paypal", "apple_pay", "bank_transfer"]
    
    data = []
    for i in range(num_records):
        product_name, category, base_price = random.choice(products)
        quantity = random.randint(1, 5)
        price = base_price * random.uniform(0.8, 1.2)  # Add some price variation
        
        record = {
            "transaction_id": f"TXN_{i+1:06d}",
            "customer_id": f"CUST_{random.randint(1, 1000):05d}",
            "product_id": f"PROD_{hash(product_name) % 10000:04d}",
            "product_name": product_name,
            "category": category,
            "price": round(price, 2),
            "quantity": quantity,
            "total": round(price * quantity, 2),
            "payment_method": random.choice(payment_methods),
            "transaction_date": (datetime.now() - timedelta(days=random.randint(0, 365))).strftime('%Y-%m-%d %H:%M:%S'),
            "shipping_address": f"{random.randint(100, 9999)} {random.choice(['Main St', 'Oak Ave', 'First St', 'Second Ave', 'Park Blvd'])}"
        }
        data.append(record)
    
    return data

def generate_sensor_readings(num_records: int = 2500) -> List[Dict[str, Any]]:
    """Generate sample IoT sensor data"""
    locations = ["Building A", "Building B", "Warehouse", "Factory Floor", "Office", "Lab"]
    device_types = ["Temperature Sensor", "Humidity Sensor", "Pressure Sensor", "Multi-Sensor"]
    statuses = ["online", "offline", "maintenance", "error"]
    alert_levels = ["normal", "warning", "critical"]
    
    data = []
    base_time = datetime.now() - timedelta(days=30)
    
    for i in range(num_records):
        timestamp = base_time + timedelta(minutes=random.randint(0, 43200))  # 30 days of data
        
        # Introduce some realistic patterns and anomalies
        temp = random.normalvariate(22, 5)  # Normal temperature around 22°C
        humidity = max(0, min(100, random.normalvariate(45, 15)))  # Humidity 0-100%
        pressure = random.normalvariate(1013.25, 10)  # Atmospheric pressure
        
        # Introduce some anomalies (5% chance)
        if random.random() < 0.05:
            temp += random.choice([-15, 15])  # Temperature spike/drop
            
        record = {
            "sensor_id": f"SENSOR_{random.randint(1, 100):03d}",
            "timestamp": timestamp.strftime('%Y-%m-%d %H:%M:%S'),
            "temperature": round(temp, 2) if random.random() > 0.02 else None,  # 2% missing
            "humidity": round(humidity, 1),
            "pressure": round(pressure, 2),
            "battery_level": random.randint(10, 100),
            "location": random.choice(locations),
            "device_type": random.choice(device_types),
            "status": random.choice(statuses),
            "alert_level": random.choice(alert_levels)
        }
        data.append(record)
    
    return data

def generate_employee_data(num_records: int = 800) -> List[Dict[str, Any]]:
    """Generate sample employee data"""
    departments = ["Engineering", "Sales", "Marketing", "HR", "Finance", "Operations", "Customer Support"]
    positions = ["Manager", "Senior", "Junior", "Lead", "Specialist", "Coordinator", "Analyst"]
    
    data = []
    for i in range(num_records):
        department = random.choice(departments)
        position = f"{random.choice(positions)} {department}"
        hire_date = datetime.now() - timedelta(days=random.randint(30, 2555))  # 1 month to 7 years
        
        record = {
            "employee_id": f"EMP_{i+1:04d}",
            "name": f"Employee {i+1}",
            "department": department,
            "position": position,
            "hire_date": hire_date.strftime('%Y-%m-%d'),
            "salary": random.randint(35000, 150000),
            "performance_score": round(random.uniform(1.0, 5.0), 1),
            "satisfaction_rating": round(random.uniform(1.0, 10.0), 1),
            "projects_completed": random.randint(0, 25),
            "training_hours": random.randint(0, 120)
        }
        data.append(record)
    
    return data

def generate_financial_transactions(num_records: int = 3000) -> List[Dict[str, Any]]:
    """Generate sample financial transaction data"""
    transaction_types = ["purchase", "withdrawal", "deposit", "transfer", "payment", "refund"]
    merchants = ["Amazon", "Starbucks", "Shell", "Walmart", "Target", "McDonald's", "Uber", "Netflix", "Spotify", "Gym"]
    categories = ["Food & Dining", "Shopping", "Gas & Transportation", "Entertainment", "Bills & Utilities", "Health & Fitness"]
    card_types = ["debit", "credit", "prepaid"]
    
    data = []
    for i in range(num_records):
        transaction_type = random.choice(transaction_types)
        amount = round(random.uniform(5.00, 2000.00), 2)
        
        # Adjust amount based on transaction type
        if transaction_type in ["withdrawal", "purchase", "payment"]:
            amount = -abs(amount)
        elif transaction_type in ["deposit", "refund"]:
            amount = abs(amount)
            
        record = {
            "transaction_id": f"FIN_{i+1:06d}",
            "account_id": f"ACC_{random.randint(1, 200):04d}",
            "transaction_type": transaction_type,
            "amount": amount,
            "balance_after": round(random.uniform(100, 50000), 2),
            "merchant": random.choice(merchants) if transaction_type == "purchase" else "",
            "category": random.choice(categories),
            "timestamp": (datetime.now() - timedelta(days=random.randint(0, 90))).strftime('%Y-%m-%d %H:%M:%S'),
            "location": f"{random.choice(['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'])}",
            "card_type": random.choice(card_types)
        }
        data.append(record)
    
    return data

def data_to_csv_string(data: List[Dict[str, Any]]) -> str:
    """Convert data list to CSV string"""
    if not data:
        return ""
    
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=data[0].keys())
    writer.writeheader()
    writer.writerows(data)
    return output.getvalue()

@router.get("/", response_model=List[Dict[str, Any]])
async def list_sample_datasets():
    """List all available sample datasets"""
    return [
        {
            "id": dataset_id,
            **dataset_info
        }
        for dataset_id, dataset_info in SAMPLE_DATASETS.items()
    ]

@router.post("/{dataset_id}/load")
async def load_sample_dataset(
    dataset_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Load a sample dataset and create an investigation"""
    
    if dataset_id not in SAMPLE_DATASETS:
        raise HTTPException(status_code=404, detail="Sample dataset not found")
    
    dataset_info = SAMPLE_DATASETS[dataset_id]
    
    # Generate the sample data
    data_generators = {
        "customer_demographics": generate_customer_demographics,
        "sales_transactions": generate_sales_transactions,
        "sensor_readings": generate_sensor_readings,
        "employee_data": generate_employee_data,
        "financial_transactions": generate_financial_transactions
    }
    
    if dataset_id not in data_generators:
        raise HTTPException(status_code=500, detail="Data generator not implemented")
    
    generator = data_generators[dataset_id]
    sample_data = generator(dataset_info["records"])
    csv_content = data_to_csv_string(sample_data)
    
    # Create investigation record
    investigation = DataInvestigation(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        name=f"Sample: {dataset_info['name']}",
        description=f"Sample dataset loaded for exploration - {dataset_info['description']}",
        file_name=dataset_info["file_name"],
        file_size=len(csv_content.encode('utf-8')),
        file_type="text/csv",
        status="running",
        progress_percentage=0,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    db.add(investigation)
    db.commit()
    db.refresh(investigation)
    
    # Store the CSV content (in a real implementation, this would go to file storage)
    # For now, we'll store it in the insights field as JSON
    investigation.insights = {
        "sample_data": True,
        "dataset_id": dataset_id,
        "csv_content": csv_content,
        "statistics": {
            "total_records": len(sample_data),
            "total_columns": len(dataset_info["columns"]),
            "file_size": len(csv_content.encode('utf-8'))
        },
        "metadata": {
            "category": dataset_info["category"],
            "use_cases": dataset_info["use_cases"],
            "columns": dataset_info["columns"]
        }
    }
    
    # Set a realistic quality score for sample data
    investigation.quality_score = random.uniform(0.75, 0.95)
    
    db.commit()
    
    # Process the investigation in the background
    background_tasks.add_task(process_sample_investigation, investigation.id, db)
    
    return {
        "investigation_id": investigation.id,
        "dataset_name": dataset_info["name"],
        "records": dataset_info["records"],
        "message": "Sample dataset loaded successfully. Processing will complete shortly."
    }

def process_sample_investigation(investigation_id: str, db: Session):
    """Process sample investigation in background"""
    import time
    import random
    
    # Simulate processing time
    time.sleep(random.uniform(2, 5))
    
    investigation = db.query(DataInvestigation).filter(DataInvestigation.id == investigation_id).first()
    if investigation:
        investigation.status = "completed"
        investigation.progress_percentage = 100
        investigation.updated_at = datetime.utcnow()
        
        # Add some realistic insights
        if investigation.insights:
            investigation.insights.update({
                "processing_completed": True,
                "quality_metrics": {
                    "completeness": random.uniform(0.85, 0.98),
                    "validity": random.uniform(0.90, 0.99),
                    "consistency": random.uniform(0.80, 0.95),
                    "accuracy": random.uniform(0.85, 0.97),
                    "uniqueness": random.uniform(0.88, 0.99)
                },
                "anomalies_detected": random.randint(0, 5),
                "patterns_found": random.randint(3, 8),
                "recommendations": [
                    "Consider normalizing date formats for consistency",
                    "Review missing values in key fields",
                    "Check for duplicate records based on primary keys",
                    "Validate email format patterns"
                ][:random.randint(2, 4)]
            })
        
        db.commit()

@router.get("/{dataset_id}")
async def get_sample_dataset_info(dataset_id: str):
    """Get detailed information about a specific sample dataset"""
    
    if dataset_id not in SAMPLE_DATASETS:
        raise HTTPException(status_code=404, detail="Sample dataset not found")
    
    return {
        "id": dataset_id,
        **SAMPLE_DATASETS[dataset_id]
    } 