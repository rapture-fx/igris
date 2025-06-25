# Semantic Layer for Revenue Insights

## What is a Semantic Layer?

A **semantic layer** is a business-intelligence abstraction that sits between your raw database and end users, providing business-friendly access to data. For revenue insights, it serves as an intelligent translation layer that:

### 🎯 Core Functions

1. **Business Terminology Mapping**
   - Translates technical database terms into business language
   - Maps `users.created_at` → "Customer Registration Date"
   - Maps `usage_metrics.metric_value` → "Revenue Amount"

2. **Metadata-Driven Query Construction**
   - Uses schema metadata to automatically build SQL queries
   - Knows which tables to join and how
   - Applies business rules consistently

3. **Natural Language to SQL**
   - Converts "What's our MRR?" into executable SQL
   - Handles date range extraction from natural language
   - Generates optimized queries with proper aggregations

4. **Business Context Provision**
   - Provides assumptions and calculation methods
   - Explains pricing models and business rules
   - Adds transparency to metrics

5. **Automatic Visualization Suggestions**
   - Recommends charts based on data structure
   - Suggests time series for temporal data
   - Proposes KPI cards for single metrics

## How Does It Provide Revenue Insights?

### 🔄 The Complete Flow

```mermaid
graph TD
    A[User Question: "What's our MRR?"] --> B[Natural Language Processing]
    B --> C[Intent Detection & Parameter Extraction]
    C --> D[Semantic Layer Mapping]
    D --> E[SQL Query Generation]
    E --> F[Database Execution]
    F --> G[Business Context Addition]
    G --> H[Visualization Suggestions]
    H --> I[Formatted Response with Charts]
```

### 💡 Example in Action

**User Question:** "What's our monthly recurring revenue for the last 3 months?"

**Semantic Layer Process:**

1. **Intent Detection:** Identifies "MRR" request
2. **Date Extraction:** Parses "last 3 months" → specific date range
3. **Metadata Lookup:** Knows MRR = API calls ($0.01) + Data processing ($0.05) + Subscriptions
4. **SQL Generation:** Creates optimized query with proper joins and aggregations
5. **Context Addition:** Explains pricing assumptions and calculation method
6. **Visualization:** Suggests line chart for trend analysis

**Generated SQL:**
```sql
-- Monthly Recurring Revenue Analysis
SELECT 
    DATE_TRUNC('month', um.recorded_at)::date AS month,
    SUM(CASE 
        WHEN um.metric_type = 'api_calls' THEN um.metric_value * 0.01
        WHEN um.metric_type = 'data_processed' THEN um.metric_value * 0.05
        WHEN um.metric_type = 'subscription_revenue' THEN um.metric_value
        ELSE 0 
    END) AS monthly_revenue,
    COUNT(DISTINCT um.user_id) AS paying_customers
FROM usage_metrics um
JOIN users u ON um.user_id = u.id
WHERE um.recorded_at >= '2024-01-01' 
AND um.recorded_at <= '2024-03-31'
AND u.is_active = true
GROUP BY DATE_TRUNC('month', um.recorded_at)
ORDER BY month DESC
```

**Business Context:**
- API calls priced at $0.01 per call
- Data processing priced at $0.05 per MB
- Only active customers included
- Revenue calculated on cash basis

## Implementation Architecture

### 🏗️ Core Components

#### 1. Business Entities (Database Table Mapping)
```python
@dataclass
class BusinessEntity:
    name: str                    # "Customers"
    table_name: str             # "users"
    description: str            # What this represents
    primary_key: str            # "id"
    business_key: str           # "email" (human-readable)
    relationships: Dict[str, str]  # How it relates to other entities
```

#### 2. Semantic Fields (Column Mapping)
```python
@dataclass
class SemanticField:
    technical_name: str         # "metric_value"
    business_name: str          # "Revenue Amount"
    description: str            # "Dollar value of revenue event"
    data_type: str             # "float"
    is_measure: bool           # Can be aggregated (SUM, AVG)
    is_dimension: bool         # Can be grouped by
    format_hint: str           # "currency", "date", "percentage"
```

#### 3. Business Metrics (Complete Definitions)
```python
@dataclass
class BusinessMetric:
    name: str                   # "Monthly Recurring Revenue (MRR)"
    description: str            # Business definition
    sql_template: str          # SQL with placeholders
    metric_type: MetricType    # REVENUE, USAGE, CUSTOMER
    parameters: List[str]      # Required inputs
    business_rules: Dict       # Pricing, assumptions
```

### 🔧 Key Methods

#### Query Generation Engine
```python
async def generate_sql_from_question(self, question: str) -> Tuple[str, Dict]:
    """
    1. Analyze natural language question
    2. Identify business metric requested
    3. Extract parameters (date ranges, filters)
    4. Generate SQL using business rules
    5. Return SQL + business context
    """
    question_lower = question.lower()
    
    # Intent detection
    if "monthly recurring revenue" in question_lower:
        return self._build_mrr_query(question)
    elif "customer acquisition cost" in question_lower:
        return self._build_cac_query(question)
    # ... more patterns
```

#### Date Range Extraction
```python
def _extract_date_range(self, question: str) -> Tuple[str, str]:
    """Extract date range from natural language"""
    if "last month" in question.lower():
        # Calculate last month's start/end dates
    elif "this quarter" in question.lower():
        # Calculate current quarter dates
    elif "last 3 months" in question.lower():
        # Calculate 3-month range
    # ... more patterns
```

#### Business Context Addition
```python
def _build_mrr_query(self, question: str) -> Tuple[str, Dict]:
    """Build MRR query with full business context"""
    metric = self.metrics["monthly_recurring_revenue"]
    sql = metric.sql_template.format(start_date=start_date, end_date=end_date)
    
    context = {
        "metric_name": metric.name,
        "business_description": metric.description,
        "assumptions": ["API calls at $0.01", "Data processing at $0.05"],
        "calculation_method": "Sum of usage-based revenue + subscriptions",
        "business_rules": metric.business_rules
    }
    
    return sql, context
```

## Usage Examples

### 📊 API Endpoints

#### Ask Business Questions
```http
POST /api/v1/insights/ask
{
  "question": "What's our monthly recurring revenue for the last 3 months?"
}
```

**Response:**
```json
{
  "question": "What's our monthly recurring revenue for the last 3 months?",
  "sql_query": "SELECT DATE_TRUNC('month'...",
  "data": [
    {"month": "2024-03-01", "monthly_revenue": 15420.50, "paying_customers": 128},
    {"month": "2024-02-01", "monthly_revenue": 12350.75, "paying_customers": 115}
  ],
  "context": {
    "metric_name": "Monthly Recurring Revenue (MRR)",
    "business_description": "Total predictable monthly revenue...",
    "assumptions": ["API calls priced at $0.01 per call"],
    "calculation_method": "Sum of (API calls × $0.01) + ..."
  },
  "visualization_suggestions": [
    {
      "type": "line_chart",
      "title": "Revenue Trend Over Time",
      "x_axis": "month",
      "y_axis": "monthly_revenue"
    }
  ]
}
```

#### Get Available Metrics
```http
GET /api/v1/insights/metrics
```

#### Validate Questions
```http
POST /api/v1/insights/validate-question?question=What's our revenue?
```

### 🖥️ Frontend Integration

```typescript
// React component using the semantic layer
const handleAskQuestion = async (question: string) => {
  const response = await fetch('/api/v1/insights/ask', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ question })
  });
  
  const insights = await response.json();
  
  // Display data with suggested visualizations
  if (insights.visualization_suggestions?.length > 0) {
    const suggestion = insights.visualization_suggestions[0];
    if (suggestion.type === 'line_chart') {
      renderLineChart(insights.data, suggestion.x_axis, suggestion.y_axis);
    }
  }
};
```

## Supported Business Questions

### 💰 Revenue Questions
- "What's our monthly recurring revenue for the last 3 months?"
- "Show me revenue trends for this quarter"
- "What's our data processing revenue this month?"
- "How much API revenue did we generate last week?"

### 👥 Customer Questions  
- "What's our customer acquisition cost?"
- "How many new customers did we acquire last month?"
- "What's our average revenue per user?"

### 📈 Usage Questions
- "How much data did we process this month?"
- "Show me API usage trends for last week"
- "What's our processing job success rate?"

### 🔄 Business Overview
- "Give me a business overview for this quarter"
- "Show me key metrics for last month"

## Advanced Features

### 🤖 LLM Integration (Future Enhancement)

The current implementation uses keyword-based intent detection. For production, integrate with an LLM:

```python
async def generate_sql_with_llm(self, question: str) -> Tuple[str, Dict]:
    """Use LLM for more sophisticated query generation"""
    
    # Prepare context for LLM
    schema_context = self.get_semantic_schema()
    available_metrics = self.get_available_metrics()
    
    # LLM prompt
    prompt = f"""
    Given this semantic schema: {schema_context}
    Available metrics: {available_metrics}
    User question: {question}
    
    Generate appropriate SQL query and business context.
    """
    
    # Call LLM (OpenAI, Claude, etc.)
    llm_response = await call_llm(prompt)
    
    return parse_llm_response(llm_response)
```

### 📊 Advanced Visualizations

```python
def suggest_advanced_visualizations(self, data: List[Dict], context: Dict) -> List[Dict]:
    """Suggest sophisticated visualizations based on data patterns"""
    
    suggestions = []
    
    # Revenue funnel analysis
    if context["metric_type"] == "revenue":
        suggestions.append({
            "type": "revenue_funnel",
            "title": "Revenue Funnel Analysis",
            "components": ["leads", "trials", "customers", "revenue"]
        })
    
    # Cohort analysis for customer metrics
    if "customer" in context["metric_name"].lower():
        suggestions.append({
            "type": "cohort_analysis", 
            "title": "Customer Cohort Analysis",
            "dimensions": ["acquisition_month", "retention_rate"]
        })
    
    return suggestions
```

### 🔐 Row-Level Security

```python
def apply_security_filters(self, sql: str, user: User) -> str:
    """Apply row-level security based on user permissions"""
    
    if user.role == "admin":
        return sql  # Full access
    elif user.role == "manager":
        # Restrict to user's organization
        return sql.replace("WHERE", f"WHERE organization_id = '{user.organization_id}' AND")
    else:
        # Restrict to user's own data
        return sql.replace("WHERE", f"WHERE user_id = '{user.id}' AND")
```

## Benefits for Your Business

### ⚡ For Business Users
- **Self-Service Analytics**: No need to write SQL or wait for developers
- **Consistent Metrics**: Everyone uses the same calculations and definitions
- **Transparent Assumptions**: Clear understanding of how metrics are calculated
- **Fast Insights**: Get answers in seconds, not hours

### 🛠️ For Developers
- **Reduced Ad-Hoc Queries**: Less time spent writing custom reports
- **Centralized Business Logic**: Single source of truth for calculations
- **Maintainable Code**: Changes to business rules update all dependent queries
- **API-First**: Easy to integrate with any frontend or external system

### 📈 For the Organization
- **Data Democracy**: Everyone can access and understand data
- **Faster Decision Making**: Real-time insights drive better decisions
- **Scalable Analytics**: Add new metrics without rewriting applications
- **Compliance Ready**: Built-in audit trails and business rule documentation

## Getting Started

1. **Define Your Business Entities**
   - Map database tables to business concepts
   - Document relationships between entities

2. **Create Semantic Field Mappings**
   - Define business-friendly names for columns
   - Specify data types and formatting rules

3. **Build Business Metrics**
   - Define SQL templates for key metrics
   - Document business rules and assumptions

4. **Implement Query Engine**
   - Build natural language processing logic
   - Create SQL generation methods

5. **Add Business Context**
   - Provide transparent explanations
   - Document calculation methods

6. **Test with Real Questions**
   - Validate with actual business users
   - Iterate based on feedback

The semantic layer transforms your Pollarbase platform from a technical data processing tool into an intelligent business analytics platform that any user can leverage for revenue insights. 