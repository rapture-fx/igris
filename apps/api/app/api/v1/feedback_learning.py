"""
API endpoints for feedback learning system
Provides REST API for collecting feedback, managing learning rules, and A/B testing
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
import logging

from app.database.connection import get_db
from app.database.models import (
    User, UserFeedback, UserLearningProfile, LearningRule,
    ABTest, ABTestResult, ServiceImprovementLog,
    FeedbackTypeEnum, FeedbackSentimentEnum
)
from app.auth.dependencies import get_current_user, get_current_active_user
from app.services.feedback_learning_engine import (
    FeedbackLearningEngine, FeedbackEvent, FeedbackType,
    get_feedback_learning_engine
)
from app.tasks.feedback_learning_tasks import (
    process_feedback_batch, trigger_learning_cycle,
    analyze_ab_test, generate_improvement_suggestions
)
from app.core.rate_limiting import RateLimiter
from app.services.core.error_handling import handle_service_error

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer()

# ========================= REQUEST/RESPONSE MODELS =========================

class FeedbackEventRequest(BaseModel):
    """Request model for submitting feedback"""
    feedback_type: str = Field(..., description="Type of feedback")
    rating: Optional[float] = Field(None, ge=1, le=5, description="Rating from 1-5")
    binary_feedback: Optional[bool] = Field(None, description="Thumbs up/down")
    text_feedback: Optional[str] = Field(None, max_length=2000, description="Text feedback")
    service_name: str = Field(..., description="Name of the service")
    operation_type: Optional[str] = Field(None, description="Type of operation")
    context: Dict[str, Any] = Field(default_factory=dict, description="Context data")
    session_id: Optional[str] = Field(None, description="Session ID")

class FeedbackResponse(BaseModel):
    """Response model for feedback submission"""
    status: str
    feedback_id: str
    immediate_insights: Dict[str, Any]
    user_profile_updated: bool
    message: Optional[str] = None

class UserInsightsResponse(BaseModel):
    """Response model for user insights"""
    user_id: str
    expertise_level: str
    total_feedback: int
    preferences: Dict[str, Any]
    behavior_patterns: Dict[str, Any]
    satisfaction_trends: Dict[str, Any]
    recommendations: List[str]

class ImprovementSuggestion(BaseModel):
    """Model for improvement suggestions"""
    priority: str
    area: str
    frequency: int
    recommendation: List[str]
    confidence: float

class ServiceImprovementResponse(BaseModel):
    """Response model for service improvements"""
    service_name: str
    suggestions: List[ImprovementSuggestion]
    feedback_analyzed: int
    confidence: float
    time_period: str

class ABTestRequest(BaseModel):
    """Request model for creating A/B tests"""
    test_name: str = Field(..., max_length=200)
    variants: List[Dict[str, Any]] = Field(..., min_items=2)
    success_metric: str = Field(..., description="Metric to optimize")
    description: Optional[str] = Field(None, max_length=1000)
    duration_days: int = Field(default=7, ge=1, le=90)

class ABTestResponse(BaseModel):
    """Response model for A/B tests"""
    test_id: str
    test_name: str
    status: str
    variants: List[Dict[str, Any]]
    results: Optional[Dict[str, Any]] = None
    winner_variant: Optional[str] = None
    confidence_level: Optional[float] = None

class LearningMetricsResponse(BaseModel):
    """Response model for learning metrics"""
    feedback_stats: Dict[str, Any]
    learning_rules: Dict[str, Any]
    user_profiles: Dict[str, Any]
    system_health: Dict[str, Any]

# ========================= FEEDBACK COLLECTION ENDPOINTS =========================

@router.post("/feedback", response_model=FeedbackResponse)
async def submit_feedback(
    feedback_request: FeedbackEventRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Submit user feedback for continuous learning
    """
    try:
        # Validate feedback type
        if feedback_request.feedback_type not in [ft.value for ft in FeedbackTypeEnum]:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid feedback type. Must be one of: {[ft.value for ft in FeedbackTypeEnum]}"
            )
        
        # Create feedback event
        feedback_event = FeedbackEvent(
            user_id=str(current_user.id),
            organization_id=str(current_user.organization_id) if current_user.organization_id else None,
            feedback_type=FeedbackType(feedback_request.feedback_type),
            context={
                "service_name": feedback_request.service_name,
                "operation": feedback_request.operation_type,
                **feedback_request.context
            },
            rating=feedback_request.rating,
            binary_feedback=feedback_request.binary_feedback,
            text_feedback=feedback_request.text_feedback,
            session_id=feedback_request.session_id
        )
        
        # Get feedback learning engine
        feedback_engine = get_feedback_learning_engine()
        
        # Process feedback
        result = await feedback_engine.collect_feedback(feedback_event)
        
        # Store in database for persistence
        db_feedback = UserFeedback(
            user_id=current_user.id,
            organization_id=current_user.organization_id,
            feedback_type=FeedbackTypeEnum(feedback_request.feedback_type),
            rating=feedback_request.rating,
            binary_feedback=feedback_request.binary_feedback,
            text_feedback=feedback_request.text_feedback,
            service_name=feedback_request.service_name,
            operation_type=feedback_request.operation_type,
            context_data=feedback_request.context,
            session_id=feedback_request.session_id,
            processed=False
        )
        
        db.add(db_feedback)
        db.commit()
        
        # Queue background processing if we have accumulated enough feedback
        if len(feedback_engine.feedback_buffer) >= 10:
            background_tasks.add_task(trigger_learning_cycle.delay)
        
        logger.info(f"Feedback submitted by user {current_user.id} for {feedback_request.service_name}")
        
        return FeedbackResponse(
            status=result["status"],
            feedback_id=result["feedback_id"],
            immediate_insights=result["immediate_insights"],
            user_profile_updated=result["user_profile_updated"]
        )
        
    except Exception as e:
        logger.error(f"Error submitting feedback: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to submit feedback: {str(e)}")

@router.post("/feedback/batch")
async def submit_feedback_batch(
    feedback_batch: List[FeedbackEventRequest],
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Submit multiple feedback events at once
    """
    try:
        if len(feedback_batch) > 100:
            raise HTTPException(status_code=400, detail="Batch size cannot exceed 100 items")
        
        # Convert to dict format for background processing
        feedback_data_list = []
        db_feedback_objects = []
        
        for feedback_request in feedback_batch:
            # Validate feedback type
            if feedback_request.feedback_type not in [ft.value for ft in FeedbackTypeEnum]:
                continue  # Skip invalid feedback
            
            feedback_data = {
                "user_id": str(current_user.id),
                "organization_id": str(current_user.organization_id) if current_user.organization_id else None,
                "feedback_type": feedback_request.feedback_type,
                "context": {
                    "service_name": feedback_request.service_name,
                    "operation": feedback_request.operation_type,
                    **feedback_request.context
                },
                "rating": feedback_request.rating,
                "binary_feedback": feedback_request.binary_feedback,
                "text_feedback": feedback_request.text_feedback,
                "session_id": feedback_request.session_id
            }
            
            feedback_data_list.append(feedback_data)
            
            # Prepare database objects
            db_feedback = UserFeedback(
                user_id=current_user.id,
                organization_id=current_user.organization_id,
                feedback_type=FeedbackTypeEnum(feedback_request.feedback_type),
                rating=feedback_request.rating,
                binary_feedback=feedback_request.binary_feedback,
                text_feedback=feedback_request.text_feedback,
                service_name=feedback_request.service_name,
                operation_type=feedback_request.operation_type,
                context_data=feedback_request.context,
                session_id=feedback_request.session_id,
                processed=False
            )
            db_feedback_objects.append(db_feedback)
        
        # Store in database
        db.add_all(db_feedback_objects)
        db.commit()
        
        # Queue background processing
        background_tasks.add_task(process_feedback_batch.delay, feedback_data_list)
        
        logger.info(f"Batch feedback submitted by user {current_user.id}: {len(feedback_data_list)} items")
        
        return {
            "status": "success",
            "submitted_count": len(feedback_data_list),
            "total_count": len(feedback_batch),
            "message": "Feedback batch queued for processing"
        }
        
    except Exception as e:
        logger.error(f"Error submitting feedback batch: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to submit feedback batch: {str(e)}")

# ========================= USER INSIGHTS ENDPOINTS =========================

@router.get("/insights/user", response_model=UserInsightsResponse)
async def get_user_insights(
    current_user: User = Depends(get_current_active_user)
):
    """
    Get personalized insights and recommendations for the current user
    """
    try:
        feedback_engine = get_feedback_learning_engine()
        insights = await feedback_engine.get_user_insights(str(current_user.id))
        
        if "error" in insights:
            # Return default insights if no profile exists
            return UserInsightsResponse(
                user_id=str(current_user.id),
                expertise_level="beginner",
                total_feedback=0,
                preferences={},
                behavior_patterns={},
                satisfaction_trends={},
                recommendations=["Start providing feedback to get personalized recommendations"]
            )
        
        return UserInsightsResponse(**insights)
        
    except Exception as e:
        logger.error(f"Error getting user insights: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get user insights: {str(e)}")

@router.get("/insights/user/{user_id}")
async def get_user_insights_admin(
    user_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get user insights (admin only or same user)
    """
    try:
        # Check permission
        if str(current_user.id) != user_id and not current_user.role.value in ["admin", "enterprise_admin"]:
            raise HTTPException(status_code=403, detail="Access denied")
        
        feedback_engine = get_feedback_learning_engine()
        insights = await feedback_engine.get_user_insights(user_id)
        
        if "error" in insights:
            raise HTTPException(status_code=404, detail="User profile not found")
        
        return insights
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user insights for admin: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get user insights: {str(e)}")

# ========================= SERVICE IMPROVEMENT ENDPOINTS =========================

@router.get("/improvements/{service_name}", response_model=ServiceImprovementResponse)
async def get_service_improvements(
    service_name: str,
    time_period_days: int = Query(default=30, ge=1, le=365),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get improvement suggestions for a specific service
    """
    try:
        feedback_engine = get_feedback_learning_engine()
        
        # Get improvement suggestions
        suggestions = await feedback_engine.get_improvement_suggestions(
            service_name, 
            {"time_period_days": time_period_days}
        )
        
        if "error" in suggestions:
            raise HTTPException(status_code=500, detail=suggestions["error"])
        
        # Convert to response format
        formatted_suggestions = []
        for suggestion in suggestions.get("priority_improvements", []):
            formatted_suggestions.append(ImprovementSuggestion(
                priority=suggestion.get("priority", "medium"),
                area=suggestion.get("area", "general"),
                frequency=suggestion.get("frequency", 0),
                recommendation=suggestion.get("recommendations", []),
                confidence=suggestions.get("confidence", 0.0)
            ))
        
        return ServiceImprovementResponse(
            service_name=service_name,
            suggestions=formatted_suggestions,
            feedback_analyzed=0,  # Would be populated from actual analysis
            confidence=suggestions.get("confidence", 0.0),
            time_period=f"{time_period_days} days"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting service improvements: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get improvements: {str(e)}")

@router.post("/improvements/{service_name}/generate")
async def trigger_improvement_analysis(
    service_name: str,
    background_tasks: BackgroundTasks,
    time_period_days: int = Query(default=30, ge=1, le=365),
    current_user: User = Depends(get_current_active_user)
):
    """
    Trigger improvement analysis for a service
    """
    try:
        # Queue background analysis
        background_tasks.add_task(
            generate_improvement_suggestions.delay,
            service_name,
            time_period_days
        )
        
        logger.info(f"Improvement analysis triggered for {service_name} by user {current_user.id}")
        
        return {
            "status": "queued",
            "service_name": service_name,
            "time_period_days": time_period_days,
            "message": "Improvement analysis queued for processing"
        }
        
    except Exception as e:
        logger.error(f"Error triggering improvement analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to trigger analysis: {str(e)}")

# ========================= A/B TESTING ENDPOINTS =========================

@router.post("/ab-tests", response_model=Dict[str, str])
async def create_ab_test(
    ab_test_request: ABTestRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Create a new A/B test
    """
    try:
        feedback_engine = get_feedback_learning_engine()
        
        # Create A/B test
        test_id = await feedback_engine.setup_ab_test(
            test_name=ab_test_request.test_name,
            variants=ab_test_request.variants,
            success_metric=ab_test_request.success_metric,
            duration_days=ab_test_request.duration_days
        )
        
        # Store in database
        db_ab_test = ABTest(
            test_name=ab_test_request.test_name,
            test_id=test_id,
            variants=ab_test_request.variants,
            success_metric=ab_test_request.success_metric,
            description=ab_test_request.description,
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow() + timedelta(days=ab_test_request.duration_days),
            created_by=current_user.id,
            organization_id=current_user.organization_id,
            status="active"
        )
        
        db.add(db_ab_test)
        db.commit()
        
        logger.info(f"A/B test created: {ab_test_request.test_name} by user {current_user.id}")
        
        return {
            "test_id": test_id,
            "status": "created",
            "message": f"A/B test '{ab_test_request.test_name}' created successfully"
        }
        
    except Exception as e:
        logger.error(f"Error creating A/B test: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create A/B test: {str(e)}")

@router.get("/ab-tests/{test_id}", response_model=ABTestResponse)
async def get_ab_test(
    test_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get A/B test details and results
    """
    try:
        # Get from database
        ab_test = db.query(ABTest).filter(ABTest.test_id == test_id).first()
        if not ab_test:
            raise HTTPException(status_code=404, detail="A/B test not found")
        
        # Check permission
        if (ab_test.organization_id != current_user.organization_id and 
            current_user.role.value not in ["admin", "enterprise_admin"]):
            raise HTTPException(status_code=403, detail="Access denied")
        
        return ABTestResponse(
            test_id=ab_test.test_id,
            test_name=ab_test.test_name,
            status=ab_test.status,
            variants=ab_test.variants,
            results=ab_test.results,
            winner_variant=ab_test.winner_variant,
            confidence_level=ab_test.confidence_level
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting A/B test: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get A/B test: {str(e)}")

@router.post("/ab-tests/{test_id}/results")
async def record_ab_test_result(
    test_id: str,
    variant_name: str,
    metric_value: float,
    context: Dict[str, Any] = {},
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Record a result for an A/B test variant
    """
    try:
        feedback_engine = get_feedback_learning_engine()
        
        # Record in learning engine
        success = await feedback_engine.record_ab_test_feedback(
            test_id=test_id,
            variant_name=variant_name,
            user_id=str(current_user.id),
            metric_value=metric_value,
            context=context
        )
        
        if not success:
            raise HTTPException(status_code=400, detail="Failed to record A/B test result")
        
        # Also store in database
        ab_test = db.query(ABTest).filter(ABTest.test_id == test_id).first()
        if ab_test:
            ab_test_result = ABTestResult(
                test_id=ab_test.id,
                user_id=current_user.id,
                variant_name=variant_name,
                metric_value=metric_value,
                context_data=context
            )
            
            db.add(ab_test_result)
            db.commit()
        
        logger.info(f"A/B test result recorded: {test_id} - {variant_name} = {metric_value}")
        
        return {
            "status": "recorded",
            "test_id": test_id,
            "variant_name": variant_name,
            "metric_value": metric_value
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error recording A/B test result: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to record result: {str(e)}")

@router.post("/ab-tests/{test_id}/analyze")
async def analyze_ab_test_endpoint(
    test_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user)
):
    """
    Trigger analysis of A/B test results
    """
    try:
        # Queue background analysis
        background_tasks.add_task(analyze_ab_test.delay, test_id)
        
        logger.info(f"A/B test analysis triggered: {test_id} by user {current_user.id}")
        
        return {
            "status": "queued",
            "test_id": test_id,
            "message": "A/B test analysis queued for processing"
        }
        
    except Exception as e:
        logger.error(f"Error triggering A/B test analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to trigger analysis: {str(e)}")

# ========================= LEARNING SYSTEM ENDPOINTS =========================

@router.get("/metrics", response_model=LearningMetricsResponse)
async def get_learning_metrics(
    current_user: User = Depends(get_current_active_user)
):
    """
    Get comprehensive learning system metrics
    """
    try:
        # Check admin permission for detailed metrics
        if current_user.role.value not in ["admin", "enterprise_admin"]:
            raise HTTPException(status_code=403, detail="Admin access required")
        
        feedback_engine = get_feedback_learning_engine()
        metrics = await feedback_engine.get_learning_metrics()
        
        return LearningMetricsResponse(**metrics)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting learning metrics: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get metrics: {str(e)}")

@router.post("/learning/trigger")
async def trigger_learning_endpoint(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user)
):
    """
    Manually trigger learning cycle (admin only)
    """
    try:
        # Check admin permission
        if current_user.role.value not in ["admin", "enterprise_admin"]:
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Queue learning cycle
        background_tasks.add_task(trigger_learning_cycle.delay)
        
        logger.info(f"Learning cycle triggered manually by user {current_user.id}")
        
        return {
            "status": "queued",
            "message": "Learning cycle queued for processing"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error triggering learning cycle: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to trigger learning: {str(e)}")

@router.get("/learning/rules")
async def get_learning_rules(
    limit: int = Query(default=50, ge=1, le=200),
    rule_type: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get learning rules with optional filtering
    """
    try:
        # Check admin permission
        if current_user.role.value not in ["admin", "enterprise_admin"]:
            raise HTTPException(status_code=403, detail="Admin access required")
        
        query = db.query(LearningRule).filter(LearningRule.is_active == True)
        
        if rule_type:
            query = query.filter(LearningRule.rule_type == rule_type)
        
        rules = query.order_by(
            LearningRule.confidence.desc(),
            LearningRule.support.desc()
        ).limit(limit).all()
        
        return {
            "total_count": len(rules),
            "rules": [
                {
                    "rule_id": rule.rule_id,
                    "rule_type": rule.rule_type,
                    "confidence": rule.confidence,
                    "support": rule.support,
                    "effectiveness": rule.effectiveness,
                    "condition": rule.condition,
                    "action": rule.action,
                    "created_at": rule.created_at.isoformat(),
                    "last_validated": rule.last_validated.isoformat() if rule.last_validated else None
                }
                for rule in rules
            ]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting learning rules: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get learning rules: {str(e)}")

# ========================= FEEDBACK ENHANCEMENT ENDPOINT =========================

@router.post("/enhance-service-call")
async def enhance_ai_service_call(
    service_name: str,
    original_params: Dict[str, Any],
    current_user: User = Depends(get_current_active_user)
):
    """
    Enhance AI service call parameters based on learned preferences
    """
    try:
        feedback_engine = get_feedback_learning_engine()
        
        enhanced_params = await feedback_engine.enhance_ai_service_call(
            service_name=service_name,
            user_id=str(current_user.id),
            original_params=original_params
        )
        
        return {
            "service_name": service_name,
            "original_params": original_params,
            "enhanced_params": enhanced_params,
            "enhancements_applied": len(enhanced_params) > len(original_params)
        }
        
    except Exception as e:
        logger.error(f"Error enhancing service call: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to enhance service call: {str(e)}")

# Add rate limiting to endpoints
rate_limiter = RateLimiter(redis_client=None)  # Initialize with Redis client if available

# Apply rate limiting to feedback endpoints
for endpoint in [submit_feedback, submit_feedback_batch]:
    endpoint = rate_limiter.limit("100/minute")(endpoint)