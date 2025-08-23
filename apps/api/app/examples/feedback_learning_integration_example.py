"""
Example: Integrating Feedback Learning System with Existing AI Services
Demonstrates various approaches to add continuous learning to your AI services
"""

import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime
import logging

from app.services.feedback_learning_engine import (
    FeedbackLearningEngine, FeedbackEvent, FeedbackType,
    get_feedback_learning_engine
)
from app.services.feedback_integration_helper import (
    with_feedback_learning, FeedbackContext, get_feedback_integration,
    register_user_satisfaction_feedback, create_feedback_collection_hook
)
from app.database.models import User

logger = logging.getLogger(__name__)

class ExistingAIService:
    """
    Example of an existing AI service that we want to enhance with feedback learning
    """
    
    def __init__(self):
        self.name = "ai_data_processor"
        # Create a feedback collection hook for this service
        self.feedback_hook = create_feedback_collection_hook(self.name)
    
    async def transform_data_original(self, data: Dict[str, Any], params: Dict[str, Any]) -> Dict[str, Any]:
        """Original service method without feedback integration"""
        # Simulate data transformation
        result = {
            "transformed_data": f"processed_{len(data)}_items",
            "confidence": 0.85,
            "processing_time": 2.5,
            "quality": "good"
        }
        return result
    
    # ========================= APPROACH 1: DECORATOR INTEGRATION =========================
    
    @with_feedback_learning("ai_data_processor", "transform")
    async def transform_data_with_decorator(self, user: User, data: Dict[str, Any], 
                                          params: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Enhanced version using the feedback learning decorator
        Automatically collects implicit feedback and enhances parameters
        """
        if params is None:
            params = {"threshold": 0.5, "method": "standard"}
        
        # The decorator automatically:
        # 1. Enhances params based on user preferences
        # 2. Monitors processing time
        # 3. Collects implicit feedback based on results
        
        # Your existing service logic here
        result = {
            "transformed_data": f"processed_{len(data)}_items",
            "confidence": 0.85 + (0.1 if params.get("method") == "enhanced" else 0),
            "quality": "excellent" if params.get("threshold", 0) > 0.7 else "good",
            "used_params": params
        }
        
        return result
    
    # ========================= APPROACH 2: CONTEXT MANAGER INTEGRATION =========================
    
    async def analyze_data_with_context(self, user: User, data: Dict[str, Any], 
                                       params: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Enhanced version using context manager for manual control
        """
        if params is None:
            params = {"algorithm": "default", "depth": 3}
        
        async with FeedbackContext("ai_data_processor", "analyze", str(user.id), 
                                  str(user.organization_id) if user.organization_id else None) as feedback_ctx:
            
            # Enhance parameters manually
            integration = get_feedback_integration()
            enhanced_params = await integration.enhance_service_params(
                self.name, str(user.id), params
            )
            
            # Your service logic here
            result = {
                "analysis": f"analyzed_{len(data)}_records",
                "insights": ["pattern1", "pattern2", "pattern3"],
                "confidence": 0.92,
                "algorithm_used": enhanced_params.get("algorithm", "default"),
                "quality": "excellent"
            }
            
            # Add detailed feedback metrics
            await feedback_ctx.add_result_metrics(
                confidence_score=result["confidence"],
                result_quality=result["quality"],
                input_data_size=len(data)
            )
            
            return result
    
    # ========================= APPROACH 3: MANUAL INTEGRATION =========================
    
    async def predict_with_manual_feedback(self, user: User, features: List[Dict], 
                                         params: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Manual integration with explicit feedback collection
        Provides full control over the feedback process
        """
        if params is None:
            params = {"model_type": "ensemble", "confidence_threshold": 0.8}
        
        start_time = datetime.utcnow()
        integration = get_feedback_integration()
        feedback_engine = get_feedback_learning_engine()
        
        # Step 1: Enhance parameters based on learned preferences
        enhanced_params = await integration.enhance_service_params(
            self.name, str(user.id), params
        )
        
        # Step 2: Perform the prediction
        result = {
            "predictions": [{"class": "A", "probability": 0.89}, {"class": "B", "probability": 0.11}],
            "confidence": 0.89,
            "model_used": enhanced_params.get("model_type", "ensemble"),
            "quality": "high" if enhanced_params.get("confidence_threshold", 0) < 0.89 else "medium"
        }
        
        # Step 3: Calculate processing time
        processing_time = (datetime.utcnow() - start_time).total_seconds()
        
        # Step 4: Create feedback context
        from app.services.feedback_integration_helper import ServiceCallContext
        context = ServiceCallContext(
            service_name=self.name,
            operation="predict",
            user_id=str(user.id),
            organization_id=str(user.organization_id) if user.organization_id else None,
            processing_time=processing_time,
            confidence_score=result["confidence"],
            result_quality=result["quality"],
            input_data_size=len(features),
            metadata={
                "model_type": result["model_used"],
                "enhanced_params": enhanced_params != params
            }
        )
        
        # Step 5: Collect implicit feedback
        await integration.collect_implicit_feedback(context, result)
        
        # Step 6: Optionally collect explicit feedback about feature usefulness
        if len(features) > 0:
            feature_feedback = FeedbackEvent(
                user_id=str(user.id),
                organization_id=str(user.organization_id) if user.organization_id else None,
                feedback_type=FeedbackType.FEATURE_USEFULNESS,
                context={
                    "service_name": self.name,
                    "operation": "predict",
                    "feature_count": len(features),
                    "confidence_achieved": result["confidence"]
                },
                rating=5.0 if result["confidence"] > 0.85 else 3.0,
                metadata={"implicit": True, "source": "feature_evaluation"}
            )
            
            await feedback_engine.collect_feedback(feature_feedback)
        
        return result
    
    # ========================= APPROACH 4: HOOK-BASED INTEGRATION =========================
    
    async def process_with_hooks(self, user: User, data: Dict[str, Any], 
                               operation: str = "process") -> Dict[str, Any]:
        """
        Integration using pre-created feedback hooks
        """
        start_time = datetime.utcnow()
        
        # Your service logic
        result = {
            "processed": True,
            "data_points": len(data),
            "confidence": 0.78,
            "quality": "good",
            "operation": operation
        }
        
        # Processing time
        processing_time = (datetime.utcnow() - start_time).total_seconds()
        
        # Use the feedback hook
        await self.feedback_hook(
            user_id=str(user.id),
            operation=operation,
            result=result,
            processing_time=processing_time,
            input_data_size=len(data)
        )
        
        return result

class EnhancedMLPipeline:
    """
    Example of enhancing an ML pipeline with comprehensive feedback learning
    """
    
    def __init__(self):
        self.ai_service = ExistingAIService()
    
    @with_feedback_learning("ml_pipeline", "full_pipeline")
    async def run_enhanced_pipeline(self, user: User, input_data: Dict[str, Any], 
                                  pipeline_config: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Full ML pipeline with automatic feedback collection
        """
        if pipeline_config is None:
            pipeline_config = {
                "preprocessing": {"normalization": True, "feature_selection": True},
                "modeling": {"algorithm": "ensemble", "cross_validation": True},
                "postprocessing": {"confidence_filtering": True}
            }
        
        results = {
            "pipeline_steps": [],
            "overall_confidence": 0.0,
            "quality_metrics": {}
        }
        
        # Step 1: Data preprocessing
        preprocessing_result = await self.ai_service.transform_data_with_decorator(
            user, input_data, pipeline_config["preprocessing"]
        )
        results["pipeline_steps"].append("preprocessing")
        results["overall_confidence"] += preprocessing_result["confidence"] * 0.3
        
        # Step 2: Feature analysis  
        analysis_result = await self.ai_service.analyze_data_with_context(
            user, preprocessing_result, pipeline_config["modeling"]
        )
        results["pipeline_steps"].append("analysis")
        results["overall_confidence"] += analysis_result["confidence"] * 0.4
        
        # Step 3: Prediction
        prediction_result = await self.ai_service.predict_with_manual_feedback(
            user, [input_data], pipeline_config["postprocessing"]
        )
        results["pipeline_steps"].append("prediction")
        results["overall_confidence"] += prediction_result["confidence"] * 0.3
        
        # Final results
        results["final_prediction"] = prediction_result["predictions"]
        results["quality_metrics"] = {
            "preprocessing_quality": preprocessing_result.get("quality", "unknown"),
            "analysis_quality": analysis_result.get("quality", "unknown"),
            "prediction_quality": prediction_result.get("quality", "unknown")
        }
        
        return results

class FeedbackLearningExamples:
    """
    Comprehensive examples of feedback learning integration
    """
    
    def __init__(self):
        self.ai_service = ExistingAIService()
        self.ml_pipeline = EnhancedMLPipeline()
    
    async def demonstrate_all_approaches(self, user: User):
        """
        Demonstrate all different integration approaches
        """
        print("=== Feedback Learning Integration Examples ===\n")
        
        sample_data = {"records": [1, 2, 3, 4, 5], "metadata": {"source": "api"}}
        sample_features = [{"feature1": 1.0, "feature2": 0.5}, {"feature1": 0.8, "feature2": 0.7}]
        
        # Approach 1: Decorator Integration
        print("1. Testing Decorator Integration...")
        result1 = await self.ai_service.transform_data_with_decorator(user, sample_data)
        print(f"   Result: {result1.get('transformed_data', 'N/A')}")
        print(f"   Confidence: {result1.get('confidence', 'N/A')}")
        
        # Approach 2: Context Manager Integration
        print("\n2. Testing Context Manager Integration...")
        result2 = await self.ai_service.analyze_data_with_context(user, sample_data)
        print(f"   Result: {result2.get('analysis', 'N/A')}")
        print(f"   Insights: {len(result2.get('insights', []))} found")
        
        # Approach 3: Manual Integration
        print("\n3. Testing Manual Integration...")
        result3 = await self.ai_service.predict_with_manual_feedback(user, sample_features)
        print(f"   Predictions: {len(result3.get('predictions', []))}")
        print(f"   Confidence: {result3.get('confidence', 'N/A')}")
        
        # Approach 4: Hook-based Integration
        print("\n4. Testing Hook-based Integration...")
        result4 = await self.ai_service.process_with_hooks(user, sample_data)
        print(f"   Processed: {result4.get('processed', False)}")
        print(f"   Data Points: {result4.get('data_points', 0)}")
        
        # Full Pipeline Example
        print("\n5. Testing Enhanced ML Pipeline...")
        pipeline_result = await self.ml_pipeline.run_enhanced_pipeline(user, sample_data)
        print(f"   Pipeline Steps: {pipeline_result.get('pipeline_steps', [])}")
        print(f"   Overall Confidence: {pipeline_result.get('overall_confidence', 0):.2f}")
        
        return {
            "decorator_result": result1,
            "context_result": result2,
            "manual_result": result3,
            "hook_result": result4,
            "pipeline_result": pipeline_result
        }
    
    async def demonstrate_explicit_feedback_collection(self, user: User):
        """
        Show how to collect explicit user feedback
        """
        print("\n=== Explicit Feedback Collection Examples ===\n")
        
        # Example 1: Register user satisfaction feedback
        satisfaction_result = await register_user_satisfaction_feedback(
            user_id=str(user.id),
            service_name="ai_data_processor",
            rating=4.5,
            text_feedback="The data transformation was fast and accurate!"
        )
        print(f"1. Satisfaction feedback registered: {satisfaction_result.get('status', 'unknown')}")
        
        # Example 2: Direct feedback event creation
        feedback_engine = get_feedback_learning_engine()
        
        transformation_feedback = FeedbackEvent(
            user_id=str(user.id),
            organization_id=str(user.organization_id) if user.organization_id else None,
            feedback_type=FeedbackType.TRANSFORMATION_RATING,
            context={
                "service_name": "ai_data_processor",
                "operation": "transform",
                "transformation_type": "normalization"
            },
            rating=5.0,
            text_feedback="Perfect normalization results!",
            binary_feedback=True
        )
        
        direct_result = await feedback_engine.collect_feedback(transformation_feedback)
        print(f"2. Direct feedback collected: {direct_result.get('feedback_id', 'N/A')}")
        
        return {
            "satisfaction_feedback": satisfaction_result,
            "direct_feedback": direct_result
        }
    
    async def demonstrate_ab_testing_integration(self, user: User):
        """
        Show how to integrate A/B testing with service calls
        """
        print("\n=== A/B Testing Integration Example ===\n")
        
        feedback_engine = get_feedback_learning_engine()
        
        # Setup A/B test
        test_id = await feedback_engine.setup_ab_test(
            test_name="Data Transformation Algorithm Comparison",
            variants=[
                {"name": "algorithm_a", "algorithm": "standard", "threshold": 0.5},
                {"name": "algorithm_b", "algorithm": "enhanced", "threshold": 0.7}
            ],
            success_metric="transformation_accuracy",
            duration_days=7
        )
        
        print(f"A/B Test created: {test_id}")
        
        # Simulate service calls with different variants
        sample_data = {"records": [1, 2, 3, 4, 5]}
        
        # Variant A
        result_a = await self.ai_service.transform_data_with_decorator(
            user, sample_data, {"algorithm": "standard", "threshold": 0.5}
        )
        
        await feedback_engine.record_ab_test_feedback(
            test_id=test_id,
            variant_name="algorithm_a",
            user_id=str(user.id),
            metric_value=result_a.get("confidence", 0.5),
            context={"transformation_quality": result_a.get("quality", "unknown")}
        )
        
        # Variant B
        result_b = await self.ai_service.transform_data_with_decorator(
            user, sample_data, {"algorithm": "enhanced", "threshold": 0.7}
        )
        
        await feedback_engine.record_ab_test_feedback(
            test_id=test_id,
            variant_name="algorithm_b", 
            user_id=str(user.id),
            metric_value=result_b.get("confidence", 0.5),
            context={"transformation_quality": result_b.get("quality", "unknown")}
        )
        
        print(f"A/B Test results recorded for both variants")
        
        # Analyze results
        analysis_result = await feedback_engine.analyze_ab_test_results(test_id)
        print(f"A/B Test Analysis: {analysis_result}")
        
        return {
            "test_id": test_id,
            "variant_a_result": result_a,
            "variant_b_result": result_b,
            "analysis": analysis_result
        }
    
    async def demonstrate_user_insights(self, user: User):
        """
        Show how to get user insights and personalization
        """
        print("\n=== User Insights and Personalization Example ===\n")
        
        feedback_engine = get_feedback_learning_engine()
        
        # Get user insights
        insights = await feedback_engine.get_user_insights(str(user.id))
        print(f"User Insights:")
        print(f"  - Expertise Level: {insights.get('expertise_level', 'unknown')}")
        print(f"  - Total Feedback: {insights.get('total_feedback', 0)}")
        print(f"  - Recommendations: {len(insights.get('recommendations', []))}")
        
        # Get service improvement suggestions
        suggestions = await feedback_engine.get_improvement_suggestions(
            "ai_data_processor", {"user_type": insights.get("expertise_level", "intermediate")}
        )
        print(f"Service Improvements:")
        print(f"  - Confidence: {suggestions.get('confidence', 0):.2f}")
        print(f"  - Priority Improvements: {len(suggestions.get('priority_improvements', []))}")
        
        return {
            "user_insights": insights,
            "improvement_suggestions": suggestions
        }

# ========================= MAIN EXAMPLE RUNNER =========================

async def main():
    """
    Main function to run all examples
    """
    # Create a sample user (in real usage, this would come from your auth system)
    from app.database.models import UserRole
    sample_user = User(
        id="550e8400-e29b-41d4-a716-446655440000",  # Example UUID
        email="example@company.com",
        username="example_user",
        role=UserRole.ANALYST,
        organization_id="550e8400-e29b-41d4-a716-446655440001"
    )
    
    # Initialize examples
    examples = FeedbackLearningExamples()
    
    try:
        # Run all demonstrations
        print("Starting Feedback Learning Integration Examples...\n")
        
        # 1. Service integration approaches
        integration_results = await examples.demonstrate_all_approaches(sample_user)
        
        # 2. Explicit feedback collection
        feedback_results = await examples.demonstrate_explicit_feedback_collection(sample_user)
        
        # 3. A/B testing integration
        ab_test_results = await examples.demonstrate_ab_testing_integration(sample_user)
        
        # 4. User insights and personalization
        insights_results = await examples.demonstrate_user_insights(sample_user)
        
        print("\n=== All Examples Completed Successfully! ===")
        
        return {
            "integration_examples": integration_results,
            "feedback_examples": feedback_results,
            "ab_test_examples": ab_test_results,
            "insights_examples": insights_results
        }
        
    except Exception as e:
        print(f"Error running examples: {str(e)}")
        logger.error(f"Examples failed: {str(e)}")
        return {"error": str(e)}

if __name__ == "__main__":
    # Run the examples
    results = asyncio.run(main())
    print(f"\nFinal Results Summary: {len(results)} example categories completed")