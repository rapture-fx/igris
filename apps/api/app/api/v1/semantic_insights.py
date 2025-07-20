"""
Semantic Insights API

Provides natural language to SQL query conversion for business insights.
Users can ask questions like "What's our MRR for last month?" and get 
back structured data and visualizations.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field
from datetime import datetime

from app.services.semantic_layer import semantic_layer
from app.core.database import get_db_session
from app.auth.dependencies import get_current_user
from app.database.models import User

router = APIRouter()


class InsightRequest(BaseModel):
    """Request model for natural language insights"""
    question: str = Field(..., description="Natural language question about your business data")
    context: Optional[Dict[str, Any]] = Field(default=None, description="Additional context for the query")


class InsightResponse(BaseModel):
    """Response model for insights"""
    question: str
    sql_query: Optional[str]
    data: List[Dict[str, Any]]
    context: Dict[str, Any]
    metadata: Dict[str, Any]
    visualization_suggestions: Optional[List[Dict[str, Any]]] = None


class AvailableMetricsResponse(BaseModel):
    """Response model for available metrics"""
    metrics: List[Dict[str, Any]]
    entities: List[Dict[str, Any]]


@router.post("/ask", response_model=InsightResponse)
async def ask_business_question(
    request: InsightRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Ask a natural language question about your business data
    
    Examples:
    - "What's our monthly recurring revenue for the last 3 months?"
    - "How much data did we process this month?"
    - "What's our customer acquisition cost?"
    - "Show me API usage trends for last week"
    """
    try:
        # Get insights from semantic layer
        insights = await semantic_layer.get_revenue_insights(request.question)
        
        # Add visualization suggestions based on the data
        viz_suggestions = _suggest_visualizations(insights)
        
        return InsightResponse(
            question=insights["question"],
            sql_query=insights.get("sql_query"),
            data=insights["data"],
            context=insights["context"],
            metadata=insights["metadata"],
            visualization_suggestions=viz_suggestions
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing question: {str(e)}")


@router.get("/metrics", response_model=AvailableMetricsResponse)
async def get_available_metrics(
    current_user: User = Depends(get_current_user)
):
    """
    Get list of available business metrics and entities
    """
    try:
        metrics_info = semantic_layer.get_available_metrics()
        return AvailableMetricsResponse(**metrics_info)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting metrics: {str(e)}")


@router.get("/schema")
async def get_semantic_schema(
    current_user: User = Depends(get_current_user)
):
    """
    Get the complete semantic schema including entities, fields, and relationships
    """
    try:
        return semantic_layer.get_semantic_schema()
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting schema: {str(e)}")


@router.post("/validate-question")
async def validate_question(
    question: str = Query(..., description="Question to validate"),
    current_user: User = Depends(get_current_user)
):
    """
    Validate if a question can be answered by the semantic layer
    """
    try:
        # Simple validation logic (can be enhanced with ML)
        revenue_keywords = ["revenue", "mrr", "arr", "income", "earnings", "sales"]
        usage_keywords = ["usage", "api", "data", "processing", "volume", "calls"]
        customer_keywords = ["customer", "user", "acquisition", "retention", "churn"]
        
        question_lower = question.lower()
        
        supported_categories = []
        if any(keyword in question_lower for keyword in revenue_keywords):
            supported_categories.append("revenue")
        if any(keyword in question_lower for keyword in usage_keywords):
            supported_categories.append("usage")
        if any(keyword in question_lower for keyword in customer_keywords):
            supported_categories.append("customer")
        
        can_answer = len(supported_categories) > 0
        
        return {
            "can_answer": can_answer,
            "confidence": 0.8 if can_answer else 0.2,
            "categories": supported_categories,
            "suggestions": _get_question_suggestions() if not can_answer else []
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error validating question: {str(e)}")


def _suggest_visualizations(insights: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Suggest appropriate visualizations based on the data structure"""
    data = insights.get("data", [])
    if not data:
        return []
    
    suggestions = []
    
    # Check data structure to suggest charts
    first_row = data[0]
    columns = list(first_row.keys())
    
    # Time series data (has date column)
    date_columns = [col for col in columns if 'date' in col.lower() or 'month' in col.lower()]
    if date_columns:
        suggestions.append({
            "type": "line_chart",
            "title": "Trend Over Time",
            "x_axis": date_columns[0],
            "y_axis": [col for col in columns if col != date_columns[0] and isinstance(first_row[col], (int, float))]
        })
    
    # Revenue data
    revenue_columns = [col for col in columns if 'revenue' in col.lower() or 'mrr' in col.lower()]
    if revenue_columns:
        suggestions.append({
            "type": "bar_chart",
            "title": "Revenue Analysis",
            "x_axis": date_columns[0] if date_columns else columns[0],
            "y_axis": revenue_columns[0]
        })
    
    # Usage data
    usage_columns = [col for col in columns if any(term in col.lower() for term in ['usage', 'calls', 'volume', 'jobs'])]
    if usage_columns:
        suggestions.append({
            "type": "area_chart", 
            "title": "Usage Patterns",
            "x_axis": date_columns[0] if date_columns else columns[0],
            "y_axis": usage_columns[0]
        })
    
    # Customer metrics
    customer_columns = [col for col in columns if any(term in col.lower() for term in ['customer', 'user', 'cac', 'arpu'])]
    if customer_columns:
        suggestions.append({
            "type": "metric_card",
            "title": "Key Customer Metrics",
            "metrics": customer_columns
        })
    
    return suggestions


def _get_question_suggestions() -> List[str]:
    """Get example questions users can ask"""
    return [
        "What's our monthly recurring revenue for the last 3 months?",
        "How much data did we process this month?",
        "What's our customer acquisition cost?",
        "Show me API usage trends for last week",
        "What's our average revenue per user?",
        "How many new customers did we acquire last month?",
        "What's the total processing volume for this quarter?",
        "Show me our revenue growth over the past year"
    ]


@router.get("/examples")
async def get_example_questions():
    """Get example questions that can be asked"""
    return {
        "revenue_questions": [
            "What's our monthly recurring revenue for the last 3 months?",
            "What's our average revenue per user this month?", 
            "Show me revenue trends for this quarter"
        ],
        "usage_questions": [
            "How much data did we process this month?",
            "Show me API usage trends for last week",
            "What's our total processing volume?"
        ],
        "customer_questions": [
            "What's our customer acquisition cost?",
            "How many new customers did we acquire?",
            "What's our customer lifetime value?"
        ]
    } 