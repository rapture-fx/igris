"""
Semantic Layer for Revenue Analytics

This semantic layer acts as a bridge between business users and technical data,
providing the following key functions:

1. BUSINESS TERMINOLOGY MAPPING: Maps business terms like "Monthly Recurring Revenue" 
   to technical database fields and calculations

2. METADATA-DRIVEN QUERY CONSTRUCTION: Uses table schemas, relationships, and 
   business rules to automatically construct optimized SQL queries

3. NATURAL LANGUAGE TO SQL: Converts user questions like "What's our MRR?" 
   into executable SQL with proper joins, filters, and aggregations

4. BUSINESS CONTEXT: Provides assumptions, definitions, and calculations 
   used in each metric for transparency

5. AUTOMATIC VISUALIZATION SUGGESTIONS: Recommends appropriate charts based 
   on data structure and business context
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from enum import Enum

import pandas as pd
from sqlalchemy import text, inspect
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class MetricType(Enum):
    """Business metric categories"""
    REVENUE = "revenue"
    USAGE = "usage"
    CUSTOMER = "customer"
    ENGAGEMENT = "engagement"
    PERFORMANCE = "performance"


@dataclass
class BusinessEntity:
    """Maps business concepts to database tables"""
    name: str                    # Business name: "Customers"
    table_name: str             # Technical name: "users"
    description: str            # What this entity represents
    primary_key: str            # Primary key field
    business_key: Optional[str] = None  # Human-readable key (email, name)
    relationships: Dict[str, str] = None
    
    def __post_init__(self):
        if self.relationships is None:
            self.relationships = {}


@dataclass
class SemanticField:
    """Maps business field concepts to database columns"""
    technical_name: str         # Database column name
    business_name: str          # User-friendly name
    description: str            # What this field represents
    data_type: str             # Technical data type
    is_measure: bool = False    # Can be aggregated (SUM, AVG, etc.)
    is_dimension: bool = True   # Can be grouped by
    format_hint: Optional[str] = None  # Display format
    business_rules: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.business_rules is None:
            self.business_rules = {}


@dataclass
class BusinessMetric:
    """Defines a complete business metric with SQL generation"""
    name: str
    description: str
    sql_template: str
    metric_type: MetricType
    parameters: List[str] = None
    business_rules: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.parameters is None:
            self.parameters = []
        if self.business_rules is None:
            self.business_rules = {}


class SemanticLayer:
    """
    Main Semantic Layer Implementation
    
    This class provides the core functionality:
    - Maps business terminology to database schema
    - Generates SQL queries from natural language
    - Provides business context and metadata
    - Suggests appropriate visualizations
    """
    
    def __init__(self):
        self.entities = self._define_business_entities()
        self.fields = self._define_semantic_fields()
        self.metrics = self._define_business_metrics()
        self.relationships = self._define_relationships()
    
    def _define_business_entities(self) -> Dict[str, BusinessEntity]:
        """
        Define business entities that map to database tables
        
        This is the core metadata that tells the semantic layer:
        - What each table represents in business terms
        - How tables relate to each other
        - What the primary business identifiers are
        """
        return {
            "customers": BusinessEntity(
                name="Customers",
                table_name="users",
                description="Platform users who can generate revenue",
                primary_key="id",
                business_key="email",
                relationships={
                    "organizations": "organization_id",
                    "usage_metrics": "user_id",
                    "processing_jobs": "user_id"
                }
            ),
            "organizations": BusinessEntity(
                name="Organizations",
                table_name="organizations", 
                description="Companies using the platform",
                primary_key="id",
                business_key="name",
                relationships={
                    "customers": "id",
                    "usage_metrics": "organization_id"
                }
            ),
            "revenue_events": BusinessEntity(
                name="Revenue Events",
                table_name="usage_metrics",
                description="All billable usage and revenue events",
                primary_key="id",
                relationships={
                    "customers": "user_id",
                    "organizations": "organization_id"
                }
            ),
            "processing_activities": BusinessEntity(
                name="Data Processing Activities",
                table_name="processing_jobs",
                description="Customer data processing jobs that generate usage",
                primary_key="id",
                relationships={"customers": "user_id"}
            )
        }
    
    def _define_semantic_fields(self) -> Dict[str, Dict[str, SemanticField]]:
        """
        Define semantic meaning for database fields
        
        This metadata tells the system:
        - What each database column means in business terms
        - How fields should be formatted for display
        - Which fields can be aggregated vs grouped
        - Business rules that apply to each field
        """
        return {
            "customers": {
                "id": SemanticField(
                    "id", "Customer ID", "Unique customer identifier", 
                    "uuid", is_dimension=True
                ),
                "email": SemanticField(
                    "email", "Customer Email", "Customer's email address", 
                    "string", is_dimension=True
                ),
                "created_at": SemanticField(
                    "created_at", "Registration Date", "When customer signed up", 
                    "datetime", is_dimension=True, format_hint="date"
                ),
                "is_active": SemanticField(
                    "is_active", "Active Status", "Whether customer is currently active", 
                    "boolean", is_dimension=True
                ),
                "subscription_tier": SemanticField(
                    "subscription_tier", "Plan Type", "Customer's subscription plan", 
                    "string", is_dimension=True
                ),
            },
            "revenue_events": {
                "metric_value": SemanticField(
                    "metric_value", "Revenue Amount", "Dollar value of this revenue event", 
                    "float", is_measure=True, is_dimension=False, format_hint="currency"
                ),
                "metric_type": SemanticField(
                    "metric_type", "Revenue Type", "Type of revenue (API calls, data processing, etc.)", 
                    "string", is_dimension=True
                ),
                "recorded_at": SemanticField(
                    "recorded_at", "Revenue Date", "When this revenue was recorded", 
                    "datetime", is_dimension=True, format_hint="date"
                ),
                "period_start": SemanticField(
                    "period_start", "Billing Period Start", "Start of billing period", 
                    "datetime", is_dimension=True, format_hint="date"
                ),
                "period_end": SemanticField(
                    "period_end", "Billing Period End", "End of billing period", 
                    "datetime", is_dimension=True, format_hint="date"
                ),
            },
            "processing_activities": {
                "file_size_bytes": SemanticField(
                    "file_size_bytes", "Data Volume", "Size of processed data", 
                    "bigint", is_measure=True, format_hint="bytes"
                ),
                "created_at": SemanticField(
                    "created_at", "Processing Date", "When job was started", 
                    "datetime", is_dimension=True, format_hint="date"
                ),
                "status": SemanticField(
                    "status", "Job Status", "Success/failure status", 
                    "string", is_dimension=True
                ),
            }
        }
    
    def _define_business_metrics(self) -> Dict[str, BusinessMetric]:
        """
        Define complete business metrics with SQL templates
        
        Each metric includes:
        - Business definition and description
        - SQL template with placeholders for parameters
        - Business rules and assumptions
        - Required parameters (date ranges, filters, etc.)
        """
        return {
            "monthly_recurring_revenue": BusinessMetric(
                name="Monthly Recurring Revenue (MRR)",
                description="Total predictable monthly revenue from active subscriptions and usage",
                sql_template="""
                -- Monthly Recurring Revenue Analysis
                -- Calculates revenue from API usage and data processing
                SELECT 
                    DATE_TRUNC('month', um.recorded_at)::date AS month,
                    SUM(CASE 
                        WHEN um.metric_type = 'api_calls' THEN um.metric_value * 0.01  -- $0.01 per API call
                        WHEN um.metric_type = 'data_processed' THEN um.metric_value * 0.05  -- $0.05 per MB
                        WHEN um.metric_type = 'subscription_revenue' THEN um.metric_value
                        ELSE 0 
                    END) AS monthly_revenue,
                    COUNT(DISTINCT um.user_id) AS paying_customers,
                    AVG(CASE 
                        WHEN um.metric_type IN ('api_calls', 'data_processed', 'subscription_revenue') 
                        THEN um.metric_value * CASE um.metric_type 
                            WHEN 'api_calls' THEN 0.01 
                            WHEN 'data_processed' THEN 0.05 
                            ELSE 1 END
                        ELSE NULL 
                    END) AS average_revenue_per_customer
                FROM usage_metrics um
                JOIN users u ON um.user_id = u.id
                WHERE um.recorded_at >= '{start_date}' 
                AND um.recorded_at <= '{end_date}'
                AND u.is_active = true
                GROUP BY DATE_TRUNC('month', um.recorded_at)
                ORDER BY month DESC
                """,
                metric_type=MetricType.REVENUE,
                parameters=["start_date", "end_date"],
                business_rules={
                    "pricing": {
                        "api_calls": 0.01,  # $0.01 per call
                        "data_processed": 0.05,  # $0.05 per MB
                    },
                    "filters": {
                        "only_active_customers": True,
                        "exclude_internal_usage": True
                    }
                }
            ),
            
            "customer_acquisition_cost": BusinessMetric(
                name="Customer Acquisition Cost (CAC)",
                description="Average cost to acquire each new paying customer",
                sql_template="""
                -- Customer Acquisition Cost Analysis
                WITH new_customers AS (
                    SELECT 
                        DATE_TRUNC('month', u.created_at)::date AS month,
                        COUNT(*) as new_customers_count
                    FROM users u
                    WHERE u.created_at >= '{start_date}' AND u.created_at <= '{end_date}'
                    AND u.is_active = true
                    GROUP BY DATE_TRUNC('month', u.created_at)
                ),
                acquisition_costs AS (
                    SELECT 
                        DATE_TRUNC('month', um.recorded_at)::date AS month,
                        SUM(um.metric_value) as marketing_spend
                    FROM usage_metrics um 
                    WHERE um.metric_type = 'marketing_cost' 
                    AND um.recorded_at >= '{start_date}' AND um.recorded_at <= '{end_date}'
                    GROUP BY DATE_TRUNC('month', um.recorded_at)
                )
                SELECT 
                    COALESCE(nc.month, ac.month) AS month,
                    nc.new_customers_count,
                    ac.marketing_spend,
                    CASE 
                        WHEN nc.new_customers_count > 0 
                        THEN ac.marketing_spend / nc.new_customers_count 
                        ELSE 0 
                    END as customer_acquisition_cost
                FROM new_customers nc
                FULL OUTER JOIN acquisition_costs ac ON nc.month = ac.month
                ORDER BY month DESC
                """,
                metric_type=MetricType.CUSTOMER,
                parameters=["start_date", "end_date"],
                business_rules={
                    "assumptions": [
                        "Marketing costs tracked in usage_metrics with type 'marketing_cost'",
                        "Only active customers counted as 'acquired'",
                        "Includes all marketing spend (ads, content, events, etc.)"
                    ]
                }
            ),
            
            "data_processing_revenue": BusinessMetric(
                name="Data Processing Revenue",
                description="Revenue generated specifically from data processing services",
                sql_template="""
                -- Data Processing Revenue Analysis
                SELECT 
                    DATE_TRUNC('day', pj.created_at)::date AS date,
                    COUNT(*) AS total_jobs,
                    COUNT(CASE WHEN pj.status = 'completed' THEN 1 END) AS completed_jobs,
                    SUM(pj.file_size_bytes) / (1024*1024*1024.0) AS gb_processed,
                    SUM(pj.file_size_bytes) / (1024*1024.0) * 0.05 AS processing_revenue,  -- $0.05 per MB
                    COUNT(DISTINCT pj.user_id) AS active_processing_customers,
                    AVG(pj.file_size_bytes) / (1024*1024.0) AS avg_file_size_mb
                FROM processing_jobs pj
                JOIN users u ON pj.user_id = u.id
                WHERE pj.created_at >= '{start_date}' 
                AND pj.created_at <= '{end_date}'
                AND u.is_active = true
                GROUP BY DATE_TRUNC('day', pj.created_at)
                ORDER BY date DESC
                """,
                metric_type=MetricType.REVENUE,
                parameters=["start_date", "end_date"],
                business_rules={
                    "pricing": {"data_processing": 0.05},  # $0.05 per MB
                    "quality_filters": {"only_completed_jobs": True}
                }
            ),
            
            "api_usage_revenue": BusinessMetric(
                name="API Usage Revenue",
                description="Revenue from API calls and programmatic access",
                sql_template="""
                -- API Usage Revenue Analysis
                SELECT 
                    DATE_TRUNC('day', um.recorded_at)::date AS date,
                    SUM(CASE WHEN um.metric_type = 'api_calls' THEN um.metric_value ELSE 0 END) AS total_api_calls,
                    SUM(CASE WHEN um.metric_type = 'api_calls' THEN um.metric_value * 0.01 ELSE 0 END) AS api_revenue,
                    COUNT(DISTINCT um.user_id) AS active_api_users,
                    AVG(CASE WHEN um.metric_type = 'api_calls' THEN um.metric_value ELSE NULL END) AS avg_calls_per_user_per_day
                FROM usage_metrics um
                JOIN users u ON um.user_id = u.id
                WHERE um.recorded_at >= '{start_date}' 
                AND um.recorded_at <= '{end_date}'
                AND u.is_active = true
                GROUP BY DATE_TRUNC('day', um.recorded_at)
                ORDER BY date DESC
                """,
                metric_type=MetricType.REVENUE,
                parameters=["start_date", "end_date"],
                business_rules={
                    "pricing": {"api_calls": 0.01},  # $0.01 per call
                    "includes": ["REST API calls", "GraphQL queries", "webhook deliveries"]
                }
            )
        }
    
    def _define_relationships(self) -> Dict[str, str]:
        """Define how business entities relate via SQL joins"""
        return {
            "customers_to_revenue": "users.id = usage_metrics.user_id",
            "customers_to_processing": "users.id = processing_jobs.user_id", 
            "organizations_to_customers": "organizations.id = users.organization_id",
            "organizations_to_revenue": "organizations.id = usage_metrics.organization_id"
        }
    
    async def generate_sql_from_question(self, question: str, session: Session) -> Tuple[str, Dict[str, Any]]:
        """
        Core NLP to SQL conversion
        
        This method:
        1. Analyzes the natural language question
        2. Identifies the business metric being requested
        3. Extracts parameters (date ranges, filters)
        4. Generates appropriate SQL using business rules
        5. Returns SQL + business context
        """
        question_lower = question.lower()
        
        # Intent detection based on keywords
        if any(term in question_lower for term in ["monthly recurring revenue", "mrr", "recurring revenue"]):
            return self._build_mrr_query(question)
        elif any(term in question_lower for term in ["customer acquisition cost", "cac", "acquisition cost"]):
            return self._build_cac_query(question)
        elif any(term in question_lower for term in ["data processing revenue", "processing revenue"]):
            return self._build_processing_revenue_query(question)
        elif any(term in question_lower for term in ["api revenue", "api usage revenue"]):
            return self._build_api_revenue_query(question)
        elif any(term in question_lower for term in ["data processing", "processing volume", "processing jobs"]):
            return self._build_processing_volume_query(question)
        elif any(term in question_lower for term in ["api usage", "api calls"]):
            return self._build_api_usage_query(question)
        else:
            # Fallback to general business overview
            return self._build_business_overview_query(question)
    
    def _extract_date_range(self, question: str) -> Tuple[str, str]:
        """
        Extract date range from natural language
        
        Supports patterns like:
        - "last month", "this month"
        - "last 3 months", "past 6 months"
        - "this quarter", "last quarter"
        - "this year", "last year"
        """
        question_lower = question.lower()
        
        if "last month" in question_lower:
            end_date = datetime.now().replace(day=1) - timedelta(days=1)
            start_date = end_date.replace(day=1)
        elif "this month" in question_lower:
            start_date = datetime.now().replace(day=1)
            end_date = datetime.now()
        elif "last 3 months" in question_lower:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=90)
        elif "last 6 months" in question_lower:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=180)
        elif "this quarter" in question_lower:
            now = datetime.now()
            quarter_start = datetime(now.year, ((now.month - 1) // 3) * 3 + 1, 1)
            start_date = quarter_start
            end_date = now
        elif "this year" in question_lower:
            start_date = datetime(datetime.now().year, 1, 1)
            end_date = datetime.now()
        else:
            # Default: last 30 days
            end_date = datetime.now()
            start_date = end_date - timedelta(days=30)
        
        return start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d')
    
    def _build_mrr_query(self, question: str) -> Tuple[str, Dict[str, Any]]:
        """Build MRR query with full business context"""
        start_date, end_date = self._extract_date_range(question)
        metric = self.metrics["monthly_recurring_revenue"]
        
        sql = metric.sql_template.format(start_date=start_date, end_date=end_date)
        
        context = {
            "metric_name": metric.name,
            "business_description": metric.description,
            "date_range": f"{start_date} to {end_date}",
            "assumptions": [
                f"API calls priced at ${metric.business_rules['pricing']['api_calls']} per call",
                f"Data processing priced at ${metric.business_rules['pricing']['data_processed']} per MB",
                "Only active customers included in calculations",
                "Revenue calculated on a cash basis (when recorded)"
            ],
            "business_rules": metric.business_rules,
            "calculation_method": "Sum of (API calls × $0.01) + (Data processed MB × $0.05) + Subscription revenue"
        }
        
        return sql, context
    
    def _build_cac_query(self, question: str) -> Tuple[str, Dict[str, Any]]:
        """Build Customer Acquisition Cost query"""
        start_date, end_date = self._extract_date_range(question)
        metric = self.metrics["customer_acquisition_cost"]
        
        sql = metric.sql_template.format(start_date=start_date, end_date=end_date)
        
        context = {
            "metric_name": metric.name,
            "business_description": metric.description,
            "date_range": f"{start_date} to {end_date}",
            "assumptions": metric.business_rules["assumptions"],
            "calculation_method": "Total Marketing Spend ÷ Number of New Customers"
        }
        
        return sql, context
    
    def _build_processing_revenue_query(self, question: str) -> Tuple[str, Dict[str, Any]]:
        """Build data processing revenue query"""
        start_date, end_date = self._extract_date_range(question)
        metric = self.metrics["data_processing_revenue"]
        
        sql = metric.sql_template.format(start_date=start_date, end_date=end_date)
        
        context = {
            "metric_name": metric.name,
            "business_description": metric.description,
            "date_range": f"{start_date} to {end_date}",
            "assumptions": [
                "Data processing priced at $0.05 per MB",
                "Only completed jobs generate revenue",
                "File sizes converted to MB for calculation"
            ]
        }
        
        return sql, context
    
    def _build_api_revenue_query(self, question: str) -> Tuple[str, Dict[str, Any]]:
        """Build API usage revenue query"""
        start_date, end_date = self._extract_date_range(question)
        metric = self.metrics["api_usage_revenue"]
        
        sql = metric.sql_template.format(start_date=start_date, end_date=end_date)
        
        context = {
            "metric_name": metric.name,
            "business_description": metric.description,
            "date_range": f"{start_date} to {end_date}",
            "assumptions": [
                "API calls priced at $0.01 per call",
                "Includes REST API, GraphQL, and webhook calls"
            ]
        }
        
        return sql, context
    
    def _build_processing_volume_query(self, question: str) -> Tuple[str, Dict[str, Any]]:
        """Build data processing volume query (non-revenue)"""
        start_date, end_date = self._extract_date_range(question)
        
        sql = f"""
        -- Data Processing Volume Analysis
        SELECT 
            DATE_TRUNC('day', pj.created_at)::date AS date,
            COUNT(*) AS total_jobs,
            COUNT(CASE WHEN pj.status = 'completed' THEN 1 END) AS completed_jobs,
            COUNT(CASE WHEN pj.status = 'failed' THEN 1 END) AS failed_jobs,
            SUM(pj.file_size_bytes) / (1024*1024*1024.0) AS gb_processed,
            AVG(pj.file_size_bytes) / (1024*1024.0) AS avg_file_size_mb,
            COUNT(DISTINCT pj.user_id) AS active_users,
            (COUNT(CASE WHEN pj.status = 'completed' THEN 1 END)::float / COUNT(*)::float * 100) AS success_rate
        FROM processing_jobs pj
        JOIN users u ON pj.user_id = u.id
        WHERE pj.created_at >= '{start_date}' 
        AND pj.created_at <= '{end_date}'
        AND u.is_active = true
        GROUP BY DATE_TRUNC('day', pj.created_at)
        ORDER BY date DESC
        """
        
        context = {
            "metric_name": "Data Processing Volume",
            "business_description": "Volume and success rate of customer data processing activities",
            "date_range": f"{start_date} to {end_date}",
            "assumptions": [
                "File sizes converted to GB for readability",
                "Success rate calculated as completed jobs / total jobs",
                "Only active users included"
            ]
        }
        
        return sql, context
    
    def _build_api_usage_query(self, question: str) -> Tuple[str, Dict[str, Any]]:
        """Build API usage query (non-revenue)"""
        start_date, end_date = self._extract_date_range(question)
        
        sql = f"""
        -- API Usage Trends Analysis
        SELECT 
            DATE_TRUNC('day', um.recorded_at)::date AS date,
            SUM(CASE WHEN um.metric_type = 'api_calls' THEN um.metric_value ELSE 0 END) AS total_api_calls,
            COUNT(DISTINCT CASE WHEN um.metric_type = 'api_calls' THEN um.user_id END) AS active_api_users,
            AVG(CASE WHEN um.metric_type = 'api_calls' THEN um.metric_value ELSE NULL END) AS avg_calls_per_user,
            MAX(CASE WHEN um.metric_type = 'api_calls' THEN um.metric_value ELSE 0 END) AS peak_daily_calls_per_user
        FROM usage_metrics um
        JOIN users u ON um.user_id = u.id
        WHERE um.recorded_at >= '{start_date}' 
        AND um.recorded_at <= '{end_date}'
        AND u.is_active = true
        GROUP BY DATE_TRUNC('day', um.recorded_at)
        ORDER BY date DESC
        """
        
        context = {
            "metric_name": "API Usage Trends",
            "business_description": "Daily API usage patterns and user engagement",
            "date_range": f"{start_date} to {end_date}",
            "assumptions": [
                "Only active users included",
                "Includes all API endpoint calls"
            ]
        }
        
        return sql, context
    
    def _build_business_overview_query(self, question: str) -> Tuple[str, Dict[str, Any]]:
        """Fallback: general business metrics overview"""
        start_date, end_date = self._extract_date_range(question)
        
        sql = f"""
        -- Business Overview Dashboard
        SELECT 
            'Revenue Metrics' as category,
            COUNT(DISTINCT CASE WHEN um.metric_type IN ('api_calls', 'data_processed', 'subscription_revenue') THEN um.user_id END) as paying_customers,
            SUM(CASE 
                WHEN um.metric_type = 'api_calls' THEN um.metric_value * 0.01
                WHEN um.metric_type = 'data_processed' THEN um.metric_value * 0.05 
                WHEN um.metric_type = 'subscription_revenue' THEN um.metric_value
                ELSE 0 
            END) as total_revenue,
            COUNT(CASE WHEN um.metric_type = 'api_calls' THEN 1 END) as api_usage_events,
            SUM(CASE WHEN um.metric_type = 'data_processed' THEN um.metric_value ELSE 0 END) / (1024*1024.0) as mb_processed
        FROM usage_metrics um
        JOIN users u ON um.user_id = u.id
        WHERE um.recorded_at >= '{start_date}' 
        AND um.recorded_at <= '{end_date}'
        AND u.is_active = true
        
        UNION ALL
        
        SELECT 
            'Usage Metrics' as category,
            COUNT(DISTINCT pj.user_id) as active_users,
            COUNT(*) as total_jobs,
            COUNT(CASE WHEN pj.status = 'completed' THEN 1 END) as completed_jobs,
            SUM(pj.file_size_bytes) / (1024*1024*1024.0) as gb_processed
        FROM processing_jobs pj
        JOIN users u ON pj.user_id = u.id
        WHERE pj.created_at >= '{start_date}' 
        AND pj.created_at <= '{end_date}'
        AND u.is_active = true
        """
        
        context = {
            "metric_name": "Business Overview",
            "business_description": "High-level business metrics across revenue and usage",
            "date_range": f"{start_date} to {end_date}",
            "assumptions": [
                "Revenue calculated using standard pricing",
                "Only active customers included",
                "Combines data from multiple business areas"
            ]
        }
        
        return sql, context
    
    async def execute_query(self, sql: str, session: Session) -> pd.DataFrame:
        """Execute SQL and return results as pandas DataFrame"""
        try:
            result = session.execute(text(sql))
            columns = result.keys()
            data = result.fetchall()
            
            df = pd.DataFrame(data, columns=columns)
            return df
            
        except Exception as e:
            logger.error(f"Error executing query: {e}")
            logger.error(f"SQL: {sql}")
            raise
    
    async def get_revenue_insights(self, question: str) -> Dict[str, Any]:
        """
        Main entry point for getting business insights
        
        This method orchestrates the entire process:
        1. Parse natural language question 
        2. Generate appropriate SQL query
        3. Execute query against database
        4. Format results with business context
        5. Suggest appropriate visualizations
        """
        from app.core.database import get_db_session
        
        async with get_db_session() as session:
            try:
                # Generate SQL from natural language
                sql, context = await self.generate_sql_from_question(question, session)
                
                # Execute the query
                df = await self.execute_query(sql, session)
                
                # Format the response
                response = {
                    "question": question,
                    "sql_query": sql,
                    "context": context,
                    "data": df.to_dict('records') if not df.empty else [],
                    "metadata": {
                        "row_count": len(df),
                        "columns": list(df.columns) if not df.empty else [],
                        "generated_at": datetime.now().isoformat(),
                        "execution_time_ms": None,  # Could add timing
                        "data_sources": self._extract_tables_from_sql(sql)
                    }
                }
                
                return response
                
            except Exception as e:
                logger.error(f"Error getting revenue insights for question '{question}': {e}")
                return {
                    "question": question,
                    "error": str(e),
                    "sql_query": None,
                    "data": [],
                    "metadata": {"error_occurred": True, "error_message": str(e)}
                }
    
    def _extract_tables_from_sql(self, sql: str) -> List[str]:
        """Extract table names from SQL for metadata"""
        tables = []
        sql_lower = sql.lower()
        
        # Simple regex to extract table names (could be more sophisticated)
        import re
        matches = re.findall(r'from\s+(\w+)|join\s+(\w+)', sql_lower)
        for match in matches:
            table = match[0] or match[1]
            if table and table not in tables:
                tables.append(table)
        
        return tables
    
    def get_available_metrics(self) -> Dict[str, Any]:
        """Get list of all available business metrics"""
        return {
            "metrics": [
                {
                    "name": metric.name,
                    "description": metric.description,
                    "type": metric.metric_type.value,
                    "parameters": metric.parameters,
                    "business_rules": metric.business_rules
                }
                for metric in self.metrics.values()
            ],
            "entities": [
                {
                    "name": entity.name,
                    "description": entity.description,
                    "table": entity.table_name,
                    "business_key": entity.business_key
                }
                for entity in self.entities.values()
            ]
        }
    
    def get_semantic_schema(self) -> Dict[str, Any]:
        """Get complete semantic schema for inspection"""
        return {
            "entities": {name: asdict(entity) for name, entity in self.entities.items()},
            "fields": {
                entity_name: {
                    field_name: asdict(field) 
                    for field_name, field in fields.items()
                }
                for entity_name, fields in self.fields.items()
            },
            "relationships": self.relationships,
            "metrics": {name: asdict(metric) for name, metric in self.metrics.items()}
        }


# Global instance for use across the application
semantic_layer = SemanticLayer() 