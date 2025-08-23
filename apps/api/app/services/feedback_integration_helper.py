"""
Feedback Integration Helper
Provides easy integration of feedback learning system with existing AI services
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime
from functools import wraps
from dataclasses import dataclass

from app.services.feedback_learning_engine import (
    FeedbackLearningEngine, FeedbackEvent, FeedbackType,
    get_feedback_learning_engine
)
from app.database.models import User

logger = logging.getLogger(__name__)

@dataclass
class ServiceCallContext:
    """Context information for AI service calls"""
    service_name: str
    operation: str
    user_id: str
    organization_id: Optional[str]
    input_data_size: Optional[int] = None
    processing_time: Optional[float] = None
    confidence_score: Optional[float] = None
    result_quality: Optional[str] = None
    metadata: Dict[str, Any] = None

class FeedbackIntegration:
    """
    Helper class to integrate feedback learning with existing AI services
    """
    
    def __init__(self):
        self.feedback_engine = get_feedback_learning_engine()
        
    async def enhance_service_params(self, service_name: str, user_id: str, 
                                   original_params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Enhance service parameters based on learned user preferences
        """
        try:
            enhanced_params = await self.feedback_engine.enhance_ai_service_call(
                service_name=service_name,
                user_id=user_id,
                original_params=original_params
            )
            
            logger.debug(f"Enhanced params for {service_name}: {len(enhanced_params) - len(original_params)} additions")
            return enhanced_params
            
        except Exception as e:
            logger.warning(f"Failed to enhance service params: {str(e)}")
            return original_params
    
    async def collect_implicit_feedback(self, context: ServiceCallContext, 
                                      result: Dict[str, Any]) -> bool:
        """
        Collect implicit feedback based on service call results
        """
        try:
            # Generate implicit feedback based on result quality indicators
            feedback_events = []
            
            # Processing time feedback
            if context.processing_time is not None:
                rating = self._get_performance_rating(context.processing_time, context.operation)
                if rating is not None:
                    feedback_events.append(FeedbackEvent(
                        user_id=context.user_id,
                        organization_id=context.organization_id,
                        feedback_type=FeedbackType.MODEL_PERFORMANCE,
                        context={
                            "service_name": context.service_name,
                            "operation": context.operation,
                            "processing_time": context.processing_time,
                            "data_size": context.input_data_size
                        },
                        rating=rating,
                        metadata={"implicit": True, "source": "performance_monitoring"}
                    ))
            
            # Confidence score feedback
            if context.confidence_score is not None:
                rating = self._get_confidence_rating(context.confidence_score)
                feedback_events.append(FeedbackEvent(
                    user_id=context.user_id,
                    organization_id=context.organization_id,
                    feedback_type=FeedbackType.PREDICTION_ACCURACY,
                    context={
                        "service_name": context.service_name,
                        "operation": context.operation,
                        "confidence_score": context.confidence_score
                    },
                    rating=rating,
                    metadata={"implicit": True, "source": "confidence_monitoring"}
                ))
            
            # Result quality feedback
            if context.result_quality is not None:
                rating = self._get_quality_rating(context.result_quality)
                if rating is not None:
                    feedback_events.append(FeedbackEvent(
                        user_id=context.user_id,
                        organization_id=context.organization_id,
                        feedback_type=FeedbackType.DATA_QUALITY_IMPROVEMENT,
                        context={
                            "service_name": context.service_name,
                            "operation": context.operation,
                            "result_quality": context.result_quality
                        },
                        rating=rating,
                        metadata={"implicit": True, "source": "quality_monitoring"}
                    ))
            
            # Collect all feedback events
            for feedback_event in feedback_events:
                await self.feedback_engine.collect_feedback(feedback_event)
            
            logger.debug(f"Collected {len(feedback_events)} implicit feedback events")
            return True
            
        except Exception as e:
            logger.error(f"Failed to collect implicit feedback: {str(e)}")
            return False
    
    def _get_performance_rating(self, processing_time: float, operation: str) -> Optional[float]:
        """Convert processing time to rating based on operation type"""
        # Define expected processing times for different operations (in seconds)
        time_expectations = {
            "transform": {"excellent": 1.0, "good": 5.0, "acceptable": 15.0},
            "predict": {"excellent": 0.5, "good": 2.0, "acceptable": 10.0},
            "analyze": {"excellent": 2.0, "good": 10.0, "acceptable": 30.0},
            "validate": {"excellent": 0.5, "good": 3.0, "acceptable": 10.0},
            "default": {"excellent": 1.0, "good": 5.0, "acceptable": 20.0}
        }
        
        expectations = time_expectations.get(operation, time_expectations["default"])
        
        if processing_time <= expectations["excellent"]:
            return 5.0
        elif processing_time <= expectations["good"]:
            return 4.0
        elif processing_time <= expectations["acceptable"]:
            return 3.0
        elif processing_time <= expectations["acceptable"] * 2:
            return 2.0
        else:
            return 1.0
    
    def _get_confidence_rating(self, confidence_score: float) -> float:
        """Convert confidence score to rating"""
        if confidence_score >= 0.9:
            return 5.0
        elif confidence_score >= 0.8:
            return 4.0
        elif confidence_score >= 0.7:
            return 3.0
        elif confidence_score >= 0.6:
            return 2.0
        else:
            return 1.0
    
    def _get_quality_rating(self, quality: str) -> Optional[float]:
        """Convert quality string to rating"""
        quality_map = {
            "excellent": 5.0,
            "good": 4.0,
            "fair": 3.0,
            "poor": 2.0,
            "very_poor": 1.0
        }
        return quality_map.get(quality.lower())

# Global instance
_feedback_integration = None

def get_feedback_integration() -> FeedbackIntegration:
    """Get global feedback integration instance"""
    global _feedback_integration
    if _feedback_integration is None:
        _feedback_integration = FeedbackIntegration()
    return _feedback_integration

# Decorator for automatic feedback integration
def with_feedback_learning(service_name: str, operation: str = "process"):
    """
    Decorator to automatically integrate feedback learning with AI service methods
    
    Usage:
        @with_feedback_learning("ai_engine", "transform")
        async def transform_data(user_id: str, data: dict, **params):
            # Your service logic here
            return result
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = datetime.utcnow()
            
            try:
                # Extract user_id from arguments
                user_id = None
                organization_id = None
                
                # Try to find user_id in args or kwargs
                if 'user_id' in kwargs:
                    user_id = kwargs['user_id']
                elif 'user' in kwargs and hasattr(kwargs['user'], 'id'):
                    user_id = str(kwargs['user'].id)
                    organization_id = str(kwargs['user'].organization_id) if kwargs['user'].organization_id else None
                elif len(args) > 0 and hasattr(args[0], 'id'):
                    user_id = str(args[0].id)
                    organization_id = str(args[0].organization_id) if hasattr(args[0], 'organization_id') and args[0].organization_id else None
                
                if not user_id:
                    # If no user_id found, proceed without feedback integration
                    return await func(*args, **kwargs)
                
                # Get feedback integration
                integration = get_feedback_integration()
                
                # Enhance parameters if possible
                if 'params' in kwargs or any(isinstance(arg, dict) for arg in args):
                    original_params = kwargs.get('params', {})
                    if not original_params and args:
                        for arg in args:
                            if isinstance(arg, dict):
                                original_params = arg
                                break
                    
                    if original_params:
                        enhanced_params = await integration.enhance_service_params(
                            service_name, user_id, original_params
                        )
                        
                        # Update kwargs with enhanced params
                        if 'params' in kwargs:
                            kwargs['params'] = enhanced_params
                        else:
                            # Find and replace the dict argument
                            args_list = list(args)
                            for i, arg in enumerate(args_list):
                                if isinstance(arg, dict):
                                    args_list[i] = enhanced_params
                                    args = tuple(args_list)
                                    break
                
                # Call the original function
                result = await func(*args, **kwargs)
                
                # Calculate processing time
                processing_time = (datetime.utcnow() - start_time).total_seconds()
                
                # Extract metrics from result if available
                confidence_score = None
                result_quality = None
                input_data_size = None
                
                if isinstance(result, dict):
                    confidence_score = result.get('confidence', result.get('confidence_score'))
                    result_quality = result.get('quality', result.get('result_quality'))
                    
                    # Try to determine input data size
                    if 'input_size' in kwargs:
                        input_data_size = kwargs['input_size']
                    elif 'data' in kwargs and hasattr(kwargs['data'], '__len__'):
                        input_data_size = len(kwargs['data'])
                
                # Create context
                context = ServiceCallContext(
                    service_name=service_name,
                    operation=operation,
                    user_id=user_id,
                    organization_id=organization_id,
                    processing_time=processing_time,
                    confidence_score=confidence_score,
                    result_quality=result_quality,
                    input_data_size=input_data_size,
                    metadata=kwargs.get('metadata', {})
                )
                
                # Collect implicit feedback
                await integration.collect_implicit_feedback(context, result)
                
                return result
                
            except Exception as e:
                logger.error(f"Error in feedback learning wrapper: {str(e)}")
                # Still call the original function even if feedback integration fails
                return await func(*args, **kwargs)
        
        return wrapper
    return decorator

# Context manager for manual feedback collection
class FeedbackContext:
    """Context manager for manual feedback collection during service calls"""
    
    def __init__(self, service_name: str, operation: str, user_id: str, organization_id: Optional[str] = None):
        self.service_name = service_name
        self.operation = operation
        self.user_id = user_id
        self.organization_id = organization_id
        self.start_time = None
        self.integration = get_feedback_integration()
        
    async def __aenter__(self):
        self.start_time = datetime.utcnow()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:  # No exception occurred
            processing_time = (datetime.utcnow() - self.start_time).total_seconds()
            
            # Create basic context
            context = ServiceCallContext(
                service_name=self.service_name,
                operation=self.operation,
                user_id=self.user_id,
                organization_id=self.organization_id,
                processing_time=processing_time
            )
            
            # Collect basic performance feedback
            await self.integration.collect_implicit_feedback(context, {"success": True})
    
    async def add_result_metrics(self, confidence_score: Optional[float] = None, 
                                result_quality: Optional[str] = None,
                                input_data_size: Optional[int] = None):
        """Add result metrics for more detailed feedback"""
        if self.start_time:
            processing_time = (datetime.utcnow() - self.start_time).total_seconds()
            
            context = ServiceCallContext(
                service_name=self.service_name,
                operation=self.operation,
                user_id=self.user_id,
                organization_id=self.organization_id,
                processing_time=processing_time,
                confidence_score=confidence_score,
                result_quality=result_quality,
                input_data_size=input_data_size
            )
            
            await self.integration.collect_implicit_feedback(context, {"success": True})

# ========================= INTEGRATION EXAMPLES =========================

class ServiceIntegrationExamples:
    """Examples of how to integrate feedback learning with existing services"""
    
    @staticmethod
    @with_feedback_learning("ai_engine", "transform")
    async def enhanced_transform_data(user: User, data: Dict[str, Any], params: Dict[str, Any]):
        """Example of using decorator for automatic integration"""
        # Service logic here - params have been automatically enhanced
        # Implicit feedback will be collected automatically
        pass
    
    @staticmethod
    async def manual_integration_example(user: User, data: Dict[str, Any]):
        """Example of manual integration using context manager"""
        async with FeedbackContext("ai_engine", "analyze", str(user.id), str(user.organization_id)) as feedback_ctx:
            # Your service logic here
            result = {"analysis": "complete", "confidence": 0.85}
            
            # Add result metrics for better feedback
            await feedback_ctx.add_result_metrics(
                confidence_score=result["confidence"],
                result_quality="good",
                input_data_size=len(data)
            )
            
            return result
    
    @staticmethod
    async def explicit_feedback_collection_example(user: User, data: Dict[str, Any]):
        """Example of explicit feedback collection"""
        integration = get_feedback_integration()
        
        # Enhance parameters
        original_params = {"threshold": 0.5}
        enhanced_params = await integration.enhance_service_params(
            "ai_engine", str(user.id), original_params
        )
        
        # Perform service operation
        start_time = datetime.utcnow()
        result = {"processed": True, "confidence": 0.92}
        processing_time = (datetime.utcnow() - start_time).total_seconds()
        
        # Create context and collect feedback
        context = ServiceCallContext(
            service_name="ai_engine",
            operation="process",
            user_id=str(user.id),
            organization_id=str(user.organization_id) if user.organization_id else None,
            processing_time=processing_time,
            confidence_score=result["confidence"],
            input_data_size=len(data)
        )
        
        await integration.collect_implicit_feedback(context, result)
        
        return result

# ========================= UTILITY FUNCTIONS =========================

async def register_user_satisfaction_feedback(user_id: str, service_name: str, 
                                            rating: float, text_feedback: Optional[str] = None):
    """
    Utility function to register explicit user satisfaction feedback
    """
    try:
        feedback_engine = get_feedback_learning_engine()
        
        feedback_event = FeedbackEvent(
            user_id=user_id,
            organization_id=None,  # Will be populated from user profile if available
            feedback_type=FeedbackType.API_SATISFACTION,
            context={"service_name": service_name},
            rating=rating,
            text_feedback=text_feedback
        )
        
        result = await feedback_engine.collect_feedback(feedback_event)
        logger.info(f"User satisfaction feedback registered: {service_name} - {rating}/5")
        
        return result
        
    except Exception as e:
        logger.error(f"Failed to register user satisfaction feedback: {str(e)}")
        return {"status": "error", "message": str(e)}

async def get_service_enhancement_suggestions(service_name: str) -> Dict[str, Any]:
    """
    Get enhancement suggestions for a service based on feedback patterns
    """
    try:
        feedback_engine = get_feedback_learning_engine()
        suggestions = await feedback_engine.get_improvement_suggestions(service_name, {})
        
        return suggestions
        
    except Exception as e:
        logger.error(f"Failed to get service enhancement suggestions: {str(e)}")
        return {"error": str(e), "suggestions": []}

def create_feedback_collection_hook(service_name: str) -> Callable:
    """
    Create a reusable feedback collection hook for a service
    """
    async def collect_feedback_hook(user_id: str, operation: str, result: Dict[str, Any], 
                                   processing_time: float, **context):
        try:
            integration = get_feedback_integration()
            
            service_context = ServiceCallContext(
                service_name=service_name,
                operation=operation,
                user_id=user_id,
                processing_time=processing_time,
                confidence_score=result.get('confidence'),
                result_quality=result.get('quality'),
                metadata=context
            )
            
            await integration.collect_implicit_feedback(service_context, result)
            
        except Exception as e:
            logger.error(f"Feedback collection hook failed: {str(e)}")
    
    return collect_feedback_hook