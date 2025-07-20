"""
Test Data Generation for Use Case Validation
Creates realistic messy datasets for each validation scenario
"""

import pandas as pd
import numpy as np
import random
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import uuid
import logging
from decimal import Decimal
import json

logger = logging.getLogger(__name__)

class TestDataGenerator:
    """Generates realistic messy datasets for validation testing"""
    
    def __init__(self, seed: int = 42):
        """Initialize with random seed for reproducible data"""
        random.seed(seed)
        np.random.seed(seed)
        self.seed = seed
    
    def generate_sales_data(self, num_records: int = 50000) -> pd.DataFrame:
        """
        Generate messy sales data for Use Case 1: Sales Prediction
        
        Creates realistic e-commerce transaction data with intentional quality issues:
        - Missing values in key fields
        - Inconsistent date formats
        - Duplicate records with variations
        - Outliers and impossible values
        - Mixed currencies
        - Inconsistent product names
        """
        logger.info(f"Generating {num_records} sales records with quality issues")
        
        # Base data generation
        data = {
            'transaction_id': [],
            'customer_id': [],
            'product_name': [],
            'product_category': [],
            'quantity': [],
            'unit_price': [],
            'currency': [],
            'revenue': [],
            'transaction_date': [],
            'customer_email': [],
            'customer_age': [],
            'shipping_country': [],
            'payment_method': []
        }
        
        # Product catalog with variations
        products = {
            'iPhone 14': ['iPhone 14', 'iphone14', 'Apple iPhone 14', 'iPhone14', 'Iphone 14'],
            'Samsung Galaxy': ['Samsung Galaxy S23', 'Galaxy S23', 'samsung galaxy s23', 'SAMSUNG GALAXY S23'],
            'MacBook Pro': ['MacBook Pro', 'Macbook Pro', 'Apple MacBook Pro', 'MacBook-Pro'],
            'Dell Laptop': ['Dell XPS 13', 'Dell laptop', 'DELL XPS13', 'Dell xps-13'],
            'Wireless Headphones': ['AirPods Pro', 'airpods pro', 'Apple AirPods Pro', 'AirPods-Pro']
        }
        
        categories = ['Electronics', 'Computers', 'Mobile', 'Audio', 'Accessories']
        countries = ['US', 'UK', 'CA', 'DE', 'FR', 'AU', 'JP', 'IN']
        currencies = ['USD', 'EUR', 'GBP', 'CAD', 'JPY']
        payment_methods = ['Credit Card', 'PayPal', 'Bank Transfer', 'Apple Pay', 'Google Pay']
        
        # Generate base customer pool (for creating duplicates)
        customer_pool = []
        for i in range(num_records // 5):  # Create customer pool
            customer_pool.append({
                'id': f"CUST_{i:06d}",
                'email': f"customer{i}@{'example' if i % 2 == 0 else 'test'}.com",
                'age': np.random.randint(18, 80)
            })
        
        for i in range(num_records):
            # Transaction ID
            data['transaction_id'].append(f"TXN_{i:08d}")
            
            # Customer data with duplicates and variations
            if i < len(customer_pool):
                customer = customer_pool[i % len(customer_pool)]
                
                # Introduce customer variations and duplicates
                if random.random() < 0.05:  # 5% duplicate customers with variations
                    if random.random() < 0.5:
                        # Slightly different customer ID
                        customer_id = customer['id'].replace('CUST_', 'CUSTOMER_')
                    else:
                        # Missing leading zeros
                        customer_id = customer['id'].replace('CUST_', 'CUST').replace('0', '', 1)
                else:
                    customer_id = customer['id']
                
                # Email variations
                email = customer['email']
                if random.random() < 0.03:  # 3% email variations
                    email = email.replace('@', '+variation@')
                
                age = customer['age']
            else:
                customer_id = f"CUST_{i:06d}"
                email = f"user{i}@domain.com"
                age = np.random.randint(18, 80)
            
            data['customer_id'].append(customer_id)
            data['customer_email'].append(email)
            data['customer_age'].append(age)
            
            # Product data with name variations
            base_product = random.choice(list(products.keys()))
            product_variations = products[base_product]
            product_name = random.choice(product_variations)
            
            data['product_name'].append(product_name)
            data['product_category'].append(random.choice(categories))
            
            # Quantity with some outliers
            if random.random() < 0.01:  # 1% extreme outliers
                quantity = np.random.randint(1000, 10000)
            elif random.random() < 0.05:  # 5% moderate outliers
                quantity = np.random.randint(50, 200)
            else:
                quantity = np.random.randint(1, 10)
            data['quantity'].append(quantity)
            
            # Price with currency variations
            currency = random.choice(currencies)
            if currency == 'USD':
                base_price = np.random.uniform(10, 2000)
            elif currency == 'EUR':
                base_price = np.random.uniform(8, 1800)
            elif currency == 'GBP':
                base_price = np.random.uniform(7, 1600)
            elif currency == 'JPY':
                base_price = np.random.uniform(1000, 200000)
            else:
                base_price = np.random.uniform(10, 2000)
            
            # Introduce price outliers and errors
            if random.random() < 0.01:  # 1% negative prices (error)
                unit_price = -abs(base_price)
            elif random.random() < 0.02:  # 2% extremely high prices
                unit_price = base_price * 100
            else:
                unit_price = round(base_price, 2)
            
            data['unit_price'].append(unit_price)
            data['currency'].append(currency)
            
            # Revenue calculation with some errors
            if random.random() < 0.03:  # 3% calculation errors
                revenue = quantity * unit_price * random.uniform(0.5, 1.5)  # Wrong calculation
            else:
                revenue = quantity * unit_price
            data['revenue'].append(round(revenue, 2))
            
            # Date with multiple formats and errors
            base_date = datetime.now() - timedelta(days=random.randint(0, 730))
            date_format_choice = random.random()
            
            if date_format_choice < 0.3:  # 30% MM/DD/YYYY
                date_str = base_date.strftime('%m/%d/%Y')
            elif date_format_choice < 0.6:  # 30% DD-MM-YY
                date_str = base_date.strftime('%d-%m-%y')
            elif date_format_choice < 0.8:  # 20% ISO format
                date_str = base_date.strftime('%Y-%m-%d')
            elif date_format_choice < 0.95:  # 15% epoch timestamp
                date_str = str(int(base_date.timestamp()))
            else:  # 5% invalid dates
                date_str = "2024-02-30"  # Invalid date
            
            data['transaction_date'].append(date_str)
            
            # Other fields
            data['shipping_country'].append(random.choice(countries))
            data['payment_method'].append(random.choice(payment_methods))
        
        # Convert to DataFrame
        df = pd.DataFrame(data)
        
        # Introduce missing values strategically
        missing_patterns = {
            'customer_id': 0.02,     # 2% missing customer IDs
            'product_category': 0.05, # 5% missing categories
            'revenue': 0.03,         # 3% missing revenue
            'customer_email': 0.08,  # 8% missing emails
            'customer_age': 0.12,    # 12% missing ages
            'shipping_country': 0.06  # 6% missing countries
        }
        
        for column, missing_rate in missing_patterns.items():
            missing_indices = np.random.choice(
                df.index, 
                size=int(len(df) * missing_rate), 
                replace=False
            )
            df.loc[missing_indices, column] = np.nan
        
        logger.info(f"Generated sales dataset with {len(df)} records and intentional quality issues")
        return df
    
    def generate_customer_data(self, num_customers: int = 100000) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        """
        Generate customer data for Use Case 2: Customer Segmentation
        
        Returns three DataFrames representing different systems:
        - CRM data
        - Billing data  
        - Support data
        """
        logger.info(f"Generating customer segmentation data for {num_customers} customers")
        
        # CRM Data
        crm_data = self._generate_crm_data(num_customers)
        
        # Billing Data (overlapping customers with schema differences)
        billing_data = self._generate_billing_data(num_customers)
        
        # Support Data
        support_data = self._generate_support_data(num_customers)
        
        return crm_data, billing_data, support_data
    
    def _generate_crm_data(self, num_customers: int) -> pd.DataFrame:
        """Generate CRM system data"""
        industries = ['Technology', 'Healthcare', 'Finance', 'Retail', 'Manufacturing', 
                     'Education', 'Government', 'Non-profit']
        company_sizes = ['1-10', '11-50', '51-200', '201-1000', '1000+']
        
        data = {
            'customer_id': [f"CRM_{i:06d}" for i in range(num_customers)],
            'company_name': [f"Company {i}" for i in range(num_customers)],
            'industry': [random.choice(industries) for _ in range(num_customers)],
            'company_size': [random.choice(company_sizes) for _ in range(num_customers)],
            'primary_contact_email': [f"contact{i}@company{i}.com" for i in range(num_customers)],
            'signup_date': [
                (datetime.now() - timedelta(days=random.randint(0, 1095))).strftime('%Y-%m-%d')
                for _ in range(num_customers)
            ],
            'account_manager': [f"AM_{i % 50}" for i in range(num_customers)]
        }
        
        df = pd.DataFrame(data)
        
        # Add missing values
        missing_indices = np.random.choice(df.index, size=int(len(df) * 0.15), replace=False)
        df.loc[missing_indices, 'industry'] = np.nan
        
        return df
    
    def _generate_billing_data(self, num_customers: int) -> pd.DataFrame:
        """Generate billing system data with schema differences"""
        plan_types = ['Basic', 'Pro', 'Enterprise', 'Custom']
        
        # Use different customer ID format and overlap
        billing_customers = int(num_customers * 0.8)  # 80% overlap
        
        data = {
            'cust_id': [f"BILL_{i:06d}" for i in range(billing_customers)],  # Different column name
            'subscription_plan': [random.choice(plan_types) for _ in range(billing_customers)],
            'monthly_revenue': [
                round(random.uniform(100, 10000), 2) for _ in range(billing_customers)
            ],
            'billing_cycle': ['monthly' if random.random() < 0.8 else 'annual' for _ in range(billing_customers)],
            'payment_status': ['paid' if random.random() < 0.9 else 'overdue' for _ in range(billing_customers)],
            'contract_start': [
                (datetime.now() - timedelta(days=random.randint(0, 1095))).strftime('%Y-%m-%d')
                for _ in range(billing_customers)
            ]
        }
        
        df = pd.DataFrame(data)
        return df
    
    def _generate_support_data(self, num_customers: int) -> pd.DataFrame:
        """Generate support system data"""
        ticket_types = ['Bug Report', 'Feature Request', 'Account Issue', 'Billing', 'Training']
        priorities = ['Low', 'Medium', 'High', 'Critical']
        
        # Generate support tickets (multiple per customer)
        num_tickets = int(num_customers * 1.5)  # 1.5 tickets per customer on average
        
        data = {
            'ticket_id': [f"TICKET_{i:08d}" for i in range(num_tickets)],
            'customer_reference': [f"CRM_{random.randint(0, num_customers-1):06d}" for _ in range(num_tickets)],
            'ticket_type': [random.choice(ticket_types) for _ in range(num_tickets)],
            'priority': [random.choice(priorities) for _ in range(num_tickets)],
            'created_date': [
                (datetime.now() - timedelta(days=random.randint(0, 365))).strftime('%Y-%m-%d')
                for _ in range(num_tickets)
            ],
            'resolution_time_hours': [
                random.randint(1, 168) if random.random() < 0.85 else np.nan  # 15% unresolved
                for _ in range(num_tickets)
            ]
        }
        
        df = pd.DataFrame(data)
        return df
    
    def generate_fraud_data(self, num_transactions: int = 500000) -> pd.DataFrame:
        """
        Generate financial transaction data for Use Case 3: Fraud Detection
        """
        logger.info(f"Generating {num_transactions} fraud detection transactions")
        
        # Create realistic transaction patterns
        merchants = [f"Merchant_{i}" for i in range(1000)]
        merchant_categories = ['Grocery', 'Gas Station', 'Restaurant', 'Online Retail', 
                             'Department Store', 'ATM', 'Hotel', 'Airline']
        countries = ['US', 'UK', 'CA', 'FR', 'DE', 'AU', 'JP', 'BR', 'IN', 'MX']
        
        data = {
            'transaction_id': [f"TXN_{i:010d}" for i in range(num_transactions)],
            'customer_id': [f"CUST_{random.randint(1, 100000):06d}" for _ in range(num_transactions)],
            'merchant_id': [random.choice(merchants) for _ in range(num_transactions)],
            'merchant_category': [random.choice(merchant_categories) for _ in range(num_transactions)],
            'amount': [],
            'currency': [],
            'transaction_timestamp': [],
            'merchant_country': [random.choice(countries) for _ in range(num_transactions)],
            'customer_country': [random.choice(countries) for _ in range(num_transactions)],
            'payment_method': [],
            'is_fraud': []  # Known labels for validation
        }
        
        payment_methods = ['Credit Card', 'Debit Card', 'Digital Wallet', 'Bank Transfer']
        
        for i in range(num_transactions):
            # Determine if this should be fraudulent (5% fraud rate)
            is_fraud = random.random() < 0.05
            
            # Generate amount based on fraud pattern
            if is_fraud:
                if random.random() < 0.3:  # High-value fraud
                    amount = random.uniform(5000, 50000)
                elif random.random() < 0.5:  # Round number fraud
                    amount = random.choice([100, 200, 500, 1000, 2000, 5000])
                else:  # Normal-looking fraud
                    amount = random.uniform(20, 500)
            else:
                # Normal transaction amounts
                category = data['merchant_category'][i]
                if category == 'Grocery':
                    amount = random.uniform(10, 200)
                elif category == 'Gas Station':
                    amount = random.uniform(20, 100)
                elif category == 'Restaurant':
                    amount = random.uniform(15, 150)
                elif category == 'Online Retail':
                    amount = random.uniform(25, 500)
                else:
                    amount = random.uniform(10, 1000)
            
            data['amount'].append(round(amount, 2))
            data['currency'].append('USD')  # Simplified for this use case
            data['payment_method'].append(random.choice(payment_methods))
            data['is_fraud'].append(1 if is_fraud else 0)
            
            # Generate timestamp with fraud patterns
            base_time = datetime.now() - timedelta(days=random.randint(0, 365))
            
            if is_fraud and random.random() < 0.4:  # 40% of fraud happens at unusual hours
                # Unusual hours (2-6 AM)
                base_time = base_time.replace(hour=random.randint(2, 6))
            else:
                # Normal hours
                base_time = base_time.replace(hour=random.randint(6, 23))
            
            data['transaction_timestamp'].append(base_time.strftime('%Y-%m-%d %H:%M:%S'))
        
        df = pd.DataFrame(data)
        
        # Add missing values and data quality issues
        missing_patterns = {
            'merchant_category': 0.03,
            'merchant_country': 0.05,
            'customer_country': 0.02
        }
        
        for column, missing_rate in missing_patterns.items():
            missing_indices = np.random.choice(
                df.index, 
                size=int(len(df) * missing_rate), 
                replace=False
            )
            df.loc[missing_indices, column] = np.nan
        
        return df
    
    def generate_time_series_data(self, num_stores: int = 100, days: int = 730) -> pd.DataFrame:
        """
        Generate time series data for Use Case 4: Forecasting
        """
        logger.info(f"Generating time series data for {num_stores} stores over {days} days")
        
        # Store metadata
        regions = ['North', 'South', 'East', 'West', 'Central']
        store_types = ['Urban', 'Suburban', 'Rural']
        
        stores = []
        for i in range(num_stores):
            stores.append({
                'store_id': f"STORE_{i:03d}",
                'region': random.choice(regions),
                'store_type': random.choice(store_types),
                'size_sqft': random.randint(5000, 50000)
            })
        
        # Generate daily sales data
        data = []
        start_date = datetime.now() - timedelta(days=days)
        
        for store in stores:
            store_base_sales = random.uniform(1000, 10000)  # Base daily sales
            
            for day in range(days):
                current_date = start_date + timedelta(days=day)
                
                # Skip some days (store closures, data collection failures)
                if random.random() < 0.02:  # 2% missing days
                    continue
                
                # Seasonal patterns
                seasonal_factor = 1.0
                if current_date.month in [11, 12]:  # Holiday season
                    seasonal_factor = 1.5
                elif current_date.month in [1, 2]:  # Post-holiday slump
                    seasonal_factor = 0.7
                
                # Day of week patterns
                dow_factor = 1.0
                if current_date.weekday() in [5, 6]:  # Weekend
                    dow_factor = 1.3
                elif current_date.weekday() == 0:  # Monday
                    dow_factor = 0.8
                
                # Add noise and trend
                trend_factor = 1 + (day / days) * 0.1  # Slight upward trend
                noise = random.uniform(0.8, 1.2)
                
                sales = store_base_sales * seasonal_factor * dow_factor * trend_factor * noise
                
                # Add outliers
                if random.random() < 0.01:  # 1% outliers
                    sales *= random.choice([0.1, 5.0])  # Very low or very high
                
                data.append({
                    'store_id': store['store_id'],
                    'date': current_date.strftime('%Y-%m-%d'),
                    'sales': round(sales, 2),
                    'region': store['region'],
                    'store_type': store['store_type'],
                    'size_sqft': store['size_sqft']
                })
        
        df = pd.DataFrame(data)
        
        # Add external factors
        df['is_holiday'] = df['date'].apply(
            lambda x: 1 if datetime.strptime(x, '%Y-%m-%d').month == 12 and 
                           datetime.strptime(x, '%Y-%m-%d').day in [24, 25, 31] else 0
        )
        
        return df
    
    def save_dataset(self, df: pd.DataFrame, filename: str, add_quality_issues: bool = True) -> str:
        """
        Save dataset with optional additional quality issues
        """
        filepath = f"/tmp/{filename}"
        
        if add_quality_issues:
            # Add encoding issues, mixed separators, etc.
            # For now, just save as CSV
            df.to_csv(filepath, index=False)
        else:
            df.to_csv(filepath, index=False)
        
        logger.info(f"Saved dataset to {filepath}")
        return filepath

# Example usage and testing
if __name__ == "__main__":
    generator = TestDataGenerator()
    
    # Generate sales data
    sales_df = generator.generate_sales_data(1000)  # Smaller for testing
    print(f"Sales data shape: {sales_df.shape}")
    print(f"Missing values:\n{sales_df.isnull().sum()}")
    
    # Generate customer data
    crm_df, billing_df, support_df = generator.generate_customer_data(1000)
    print(f"CRM data shape: {crm_df.shape}")
    print(f"Billing data shape: {billing_df.shape}")
    print(f"Support data shape: {support_df.shape}")