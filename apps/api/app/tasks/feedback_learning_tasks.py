"""
Celery tasks for feedback learning system
Handles background processing of feedback data and continuous learning
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from celery import Celery
from sqlalchemy.orm import Session

from app.core.celery_app import celery_app
from app.database.connection import get_db_session
from app.database.models import (
    UserFeedback, UserLearningProfile, LearningRule, 
    ABTest, ABTestResult, ServiceImprovementLog,
    FeedbackTypeEnum, FeedbackSentimentEnum
)
from app.services.feedback_learning_engine import (
    FeedbackLearningEngine, FeedbackEvent, FeedbackType,
    get_feedback_learning_engine
)
from app.core.redis_client import get_redis_client
from app.services.core.error_handling import handle_service_error

logger = logging.getLogger(__name__)

@celery_app.task(bind=True, retry_backoff=True, max_retries=3)
def process_feedback_batch(self, feedback_data_list: List[Dict[str, Any]]):
    """
    Process a batch of feedback events in the background
    
    Args:
        feedback_data_list: List of feedback event dictionaries
    """
    try:
        logger.info(f"Processing batch of {len(feedback_data_list)} feedback events")
        
        with get_db_session() as db:
            feedback_engine = get_feedback_learning_engine()
            processed_count = 0
            
            for feedback_data in feedback_data_list:
                try:
                    # Convert dict to FeedbackEvent
                    feedback_event = FeedbackEvent(
                        user_id=feedback_data["user_id"],
                        organization_id=feedback_data.get("organization_id"),
                        feedback_type=FeedbackType(feedback_data["feedback_type"]),
                        context=feedback_data["context"],
                        rating=feedback_data.get("rating"),
                        binary_feedback=feedback_data.get("binary_feedback"),
                        text_feedback=feedback_data.get("text_feedback"),
                        metadata=feedback_data.get("metadata", {}),
                        session_id=feedback_data.get("session_id")
                    )
                    
                    # Store in database
                    db_feedback = UserFeedback(
                        user_id=feedback_event.user_id,
                        organization_id=feedback_event.organization_id,
                        feedback_type=FeedbackTypeEnum(feedback_event.feedback_type.value),
                        rating=feedback_event.rating,
                        binary_feedback=feedback_event.binary_feedback,
                        text_feedback=feedback_event.text_feedback,
                        service_name=feedback_event.context.get("service_name"),
                        operation_type=feedback_event.context.get("operation"),
                        context_data=feedback_event.context,
                        session_id=feedback_event.session_id,
                        processed=False
                    )
                    
                    db.add(db_feedback)
                    processed_count += 1
                    
                except Exception as e:
                    logger.error(f"Error processing individual feedback: {str(e)}")
                    continue
            
            db.commit()
            logger.info(f"Successfully processed {processed_count}/{len(feedback_data_list)} feedback events")
            
            # Trigger learning if we have enough feedback
            if processed_count >= 10:
                trigger_learning_cycle.delay()
            
            return {
                "status": "success",
                "processed_count": processed_count,
                "total_count": len(feedback_data_list)
            }
            
    except Exception as e:
        logger.error(f"Error in feedback batch processing: {str(e)}")
        raise self.retry(exc=e, countdown=60 * (self.request.retries + 1))

@celery_app.task(bind=True, retry_backoff=True, max_retries=3)
def trigger_learning_cycle(self):
    """
    Trigger a complete learning cycle to extract patterns and update rules
    """
    try:
        logger.info("Starting learning cycle")
        
        with get_db_session() as db:
            feedback_engine = get_feedback_learning_engine()
            
            # Get unprocessed feedback from database
            unprocessed_feedback = db.query(UserFeedback).filter(
                UserFeedback.processed == False
            ).limit(1000).all()
            
            if not unprocessed_feedback:
                logger.info("No unprocessed feedback found")
                return {"status": "no_data", "message": "No unprocessed feedback"}
            
            # Convert to FeedbackEvent objects
            feedback_events = []
            for db_feedback in unprocessed_feedback:
                feedback_event = FeedbackEvent(
                    user_id=str(db_feedback.user_id),
                    organization_id=str(db_feedback.organization_id) if db_feedback.organization_id else None,
                    feedback_type=FeedbackType(db_feedback.feedback_type.value),
                    context=db_feedback.context_data or {},
                    rating=db_feedback.rating,
                    binary_feedback=db_feedback.binary_feedback,
                    text_feedback=db_feedback.text_feedback,
                    timestamp=db_feedback.created_at
                )
                feedback_events.append(feedback_event)
            
            # Add to engine buffer for processing
            feedback_engine.feedback_buffer.extend(feedback_events)
            
            # Trigger learning
            import asyncio
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            try:
                loop.run_until_complete(feedback_engine._trigger_learning())
                
                # Update user profiles
                loop.run_until_complete(update_user_profiles_task())
                
                # Mark feedback as processed
                for db_feedback in unprocessed_feedback:
                    db_feedback.processed = True
                    db_feedback.processed_at = datetime.utcnow()
                
                db.commit()
                
                logger.info(f"Learning cycle completed for {len(feedback_events)} feedback events")
                
                return {
                    "status": "success",
                    "processed_feedback": len(feedback_events),
                    "new_rules": len(feedback_engine.learning_rules)
                }
                
            finally:
                loop.close()
                
    except Exception as e:
        logger.error(f"Error in learning cycle: {str(e)}")
        raise self.retry(exc=e, countdown=60 * (self.request.retries + 1))

@celery_app.task(bind=True, retry_backoff=True, max_retries=3)
async def update_user_profiles_task(self):
    """
    Update user learning profiles based on recent feedback
    """
    try:
        logger.info("Updating user learning profiles")
        
        with get_db_session() as db:
            feedback_engine = get_feedback_learning_engine()
            
            # Get users with recent feedback
            recent_feedback = db.query(UserFeedback).filter(
                UserFeedback.created_at >= datetime.utcnow() - timedelta(days=7),
                UserFeedback.processed == True
            ).all()
            
            user_feedback_map = {}
            for feedback in recent_feedback:
                user_id = str(feedback.user_id)
                if user_id not in user_feedback_map:
                    user_feedback_map[user_id] = []
                user_feedback_map[user_id].append(feedback)
            
            updated_profiles = 0
            
            for user_id, feedback_list in user_feedback_map.items():
                try:
                    # Get or create user learning profile
                    profile = db.query(UserLearningProfile).filter(
                        UserLearningProfile.user_id == user_id
                    ).first()
                    
                    if not profile:
                        profile = UserLearningProfile(
                            user_id=user_id,
                            organization_id=feedback_list[0].organization_id,
                            expertise_level="intermediate",
                            preferences={},
                            behavior_patterns={},
                            total_feedback_count=0,
                            average_satisfaction=3.0,
                            engagement_score=0.5
                        )
                        db.add(profile)
                    
                    # Update profile metrics
                    profile.total_feedback_count = db.query(UserFeedback).filter(
                        UserFeedback.user_id == user_id
                    ).count()
                    
                    # Calculate average satisfaction
                    ratings = [f.rating for f in feedback_list if f.rating is not None]
                    if ratings:
                        profile.average_satisfaction = sum(ratings) / len(ratings)
                    
                    # Update engagement score based on feedback frequency and detail
                    detailed_feedback_count = sum(1 for f in feedback_list if f.text_feedback)
                    profile.engagement_score = min(
                        (len(feedback_list) / 30.0) + (detailed_feedback_count / 10.0), 
                        1.0
                    )
                    
                    # Update expertise level
                    if profile.total_feedback_count >= 100 and profile.engagement_score >= 0.7:
                        profile.expertise_level = "advanced"
                    elif profile.total_feedback_count >= 20 and profile.engagement_score >= 0.4:
                        profile.expertise_level = "intermediate"
                    else:
                        profile.expertise_level = "beginner"
                    
                    profile.last_activity = datetime.utcnow()
                    profile.updated_at = datetime.utcnow()
                    
                    updated_profiles += 1
                    
                except Exception as e:
                    logger.error(f"Error updating profile for user {user_id}: {str(e)}")
                    continue
            
            db.commit()
            
            logger.info(f"Updated {updated_profiles} user learning profiles")
            
            return {
                "status": "success",
                "updated_profiles": updated_profiles
            }
            
    except Exception as e:
        logger.error(f"Error updating user profiles: {str(e)}")
        raise self.retry(exc=e, countdown=60 * (self.request.retries + 1))

@celery_app.task(bind=True, retry_backoff=True, max_retries=3)
def validate_learning_rules(self):
    """
    Validate effectiveness of existing learning rules
    """
    try:
        logger.info("Validating learning rules")
        
        with get_db_session() as db:
            # Get active learning rules
            rules = db.query(LearningRule).filter(
                LearningRule.is_active == True
            ).all()
            
            validated_rules = 0
            deactivated_rules = 0
            
            for rule in rules:
                try:
                    # Check if rule needs validation (older than 7 days)
                    if (rule.last_validated and 
                        datetime.utcnow() - rule.last_validated < timedelta(days=7)):
                        continue
                    
                    # Get recent feedback that matches this rule's conditions
                    # This is a simplified validation - in production, you'd want more sophisticated metrics
                    recent_feedback = db.query(UserFeedback).filter(
                        UserFeedback.created_at >= datetime.utcnow() - timedelta(days=30),
                        UserFeedback.processed == True
                    ).all()
                    
                    rule_effectiveness = 0.0
                    matching_feedback_count = 0
                    
                    for feedback in recent_feedback:
                        # Check if feedback matches rule conditions (simplified)
                        if rule.rule_type == "user_preference":
                            condition = rule.condition
                            if (f"{feedback.user_id}:{feedback.feedback_type.value}" in 
                                condition.get("user_type_key", "")):
                                matching_feedback_count += 1
                                if feedback.rating and feedback.rating >= 4:
                                    rule_effectiveness += 1
                    
                    if matching_feedback_count > 0:
                        rule_effectiveness = rule_effectiveness / matching_feedback_count
                        rule.effectiveness = rule_effectiveness
                        
                        # Deactivate rule if effectiveness is too low
                        if rule_effectiveness < 0.3 and matching_feedback_count >= 10:
                            rule.is_active = False
                            deactivated_rules += 1
                            logger.info(f"Deactivated rule {rule.rule_id} due to low effectiveness: {rule_effectiveness}")
                    
                    rule.last_validated = datetime.utcnow()
                    rule.validation_count = (rule.validation_count or 0) + 1
                    rule.updated_at = datetime.utcnow()
                    
                    validated_rules += 1
                    
                except Exception as e:
                    logger.error(f"Error validating rule {rule.rule_id}: {str(e)}")
                    continue
            
            db.commit()
            
            logger.info(f"Validated {validated_rules} rules, deactivated {deactivated_rules} rules")
            
            return {
                "status": "success",
                "validated_rules": validated_rules,
                "deactivated_rules": deactivated_rules
            }
            
    except Exception as e:
        logger.error(f"Error validating learning rules: {str(e)}")
        raise self.retry(exc=e, countdown=60 * (self.request.retries + 1))

@celery_app.task(bind=True, retry_backoff=True, max_retries=3)
def analyze_ab_test(self, test_id: str):
    """
    Analyze A/B test results and determine winners
    
    Args:
        test_id: The ID of the A/B test to analyze
    """
    try:
        logger.info(f"Analyzing A/B test: {test_id}")
        
        with get_db_session() as db:
            # Get test
            ab_test = db.query(ABTest).filter(ABTest.test_id == test_id).first()
            if not ab_test:
                logger.error(f"A/B test not found: {test_id}")
                return {"status": "error", "message": "Test not found"}
            
            # Get test results
            results = db.query(ABTestResult).filter(
                ABTestResult.test_id == ab_test.id
            ).all()
            
            if not results:
                logger.info(f"No results yet for A/B test: {test_id}")
                return {"status": "no_data", "message": "No results available"}
            
            # Analyze results by variant
            variant_stats = {}
            for result in results:
                variant = result.variant_name
                if variant not in variant_stats:
                    variant_stats[variant] = {
                        "values": [],
                        "count": 0,
                        "sum": 0,
                        "mean": 0
                    }
                
                variant_stats[variant]["values"].append(result.metric_value)
                variant_stats[variant]["count"] += 1
                variant_stats[variant]["sum"] += result.metric_value
            
            # Calculate statistics
            for variant, stats in variant_stats.items():
                if stats["count"] > 0:
                    stats["mean"] = stats["sum"] / stats["count"]
                    if len(stats["values"]) > 1:
                        import statistics
                        stats["std"] = statistics.stdev(stats["values"])
                    else:
                        stats["std"] = 0
            
            # Determine winner (highest mean)
            if len(variant_stats) >= 2:
                winner_variant = max(variant_stats.items(), key=lambda x: x[1]["mean"])
                
                # Update test with results
                ab_test.results = {
                    variant: {
                        "count": stats["count"],
                        "mean": stats["mean"],
                        "std": stats.get("std", 0)
                    }
                    for variant, stats in variant_stats.items()
                }
                
                ab_test.winner_variant = winner_variant[0]
                
                # Calculate confidence based on sample size and difference
                total_samples = sum(stats["count"] for stats in variant_stats.values())
                ab_test.confidence_level = min(total_samples / 100.0, 1.0)  # Simplified confidence
                
                # Mark as completed if confidence is high enough or test period ended
                if (ab_test.confidence_level >= 0.95 or 
                    datetime.utcnow() > ab_test.end_time):
                    ab_test.status = "completed"
                
                ab_test.updated_at = datetime.utcnow()
                db.commit()
                
                logger.info(f"A/B test {test_id} analyzed. Winner: {ab_test.winner_variant} with confidence {ab_test.confidence_level}")
                
                return {
                    "status": "success",
                    "winner": ab_test.winner_variant,
                    "confidence": ab_test.confidence_level,
                    "results": ab_test.results
                }
            else:
                return {
                    "status": "insufficient_variants",
                    "message": "Need at least 2 variants for comparison"
                }
                
    except Exception as e:
        logger.error(f"Error analyzing A/B test: {str(e)}")
        raise self.retry(exc=e, countdown=60 * (self.request.retries + 1))

@celery_app.task(bind=True, retry_backoff=True, max_retries=3)
def generate_improvement_suggestions(self, service_name: str, time_period_days: int = 30):
    """
    Generate improvement suggestions for a service based on feedback analysis
    
    Args:
        service_name: Name of the service to analyze
        time_period_days: Number of days to look back for feedback
    """
    try:
        logger.info(f"Generating improvement suggestions for {service_name}")
        
        with get_db_session() as db:
            feedback_engine = get_feedback_learning_engine()
            
            # Get recent feedback for the service
            cutoff_date = datetime.utcnow() - timedelta(days=time_period_days)
            service_feedback = db.query(UserFeedback).filter(
                UserFeedback.service_name == service_name,
                UserFeedback.created_at >= cutoff_date,
                UserFeedback.processed == True
            ).all()
            
            if not service_feedback:
                logger.info(f"No recent feedback found for {service_name}")
                return {"status": "no_data", "message": "No recent feedback"}
            
            # Analyze feedback patterns
            low_satisfaction_areas = []
            high_satisfaction_areas = []
            
            for feedback in service_feedback:
                if feedback.rating:
                    if feedback.rating <= 2:
                        low_satisfaction_areas.append({
                            "feedback_type": feedback.feedback_type.value,
                            "rating": feedback.rating,
                            "context": feedback.context_data,
                            "text": feedback.text_feedback
                        })
                    elif feedback.rating >= 4:
                        high_satisfaction_areas.append({
                            "feedback_type": feedback.feedback_type.value,
                            "rating": feedback.rating,
                            "context": feedback.context_data
                        })
            
            # Generate improvement suggestions
            suggestions = []
            
            if low_satisfaction_areas:
                # Group by feedback type
                from collections import Counter
                low_areas_counter = Counter(item["feedback_type"] for item in low_satisfaction_areas)
                
                for feedback_type, count in low_areas_counter.most_common(3):
                    suggestions.append({
                        "priority": "high",
                        "area": feedback_type,
                        "frequency": count,
                        "recommendation": feedback_engine._get_area_recommendations(
                            feedback_type, 
                            [item for item in low_satisfaction_areas 
                             if item["feedback_type"] == feedback_type]
                        )
                    })
            
            # Create improvement log entry
            improvement_log = ServiceImprovementLog(
                service_name=service_name,
                improvement_type="feedback_analysis",
                description=f"Improvement suggestions generated from {len(service_feedback)} feedback events",
                feedback_basis={
                    "total_feedback": len(service_feedback),
                    "low_satisfaction_count": len(low_satisfaction_areas),
                    "high_satisfaction_count": len(high_satisfaction_areas),
                    "time_period_days": time_period_days
                },
                expected_impact="improve_user_satisfaction",
                implemented=False
            )
            
            db.add(improvement_log)
            db.commit()
            
            logger.info(f"Generated {len(suggestions)} improvement suggestions for {service_name}")
            
            return {
                "status": "success",
                "service_name": service_name,
                "suggestions": suggestions,
                "feedback_analyzed": len(service_feedback),
                "improvement_log_id": str(improvement_log.id)
            }
            
    except Exception as e:
        logger.error(f"Error generating improvement suggestions: {str(e)}")
        raise self.retry(exc=e, countdown=60 * (self.request.retries + 1))

# ========================= SCHEDULED TASKS =========================

@celery_app.task
def daily_feedback_processing():
    """Daily task to process accumulated feedback and update learning models"""
    logger.info("Starting daily feedback processing")
    
    # Trigger learning cycle
    trigger_learning_cycle.delay()
    
    # Update user profiles  
    import asyncio
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        loop.run_until_complete(update_user_profiles_task())
    finally:
        loop.close()
    
    # Validate learning rules
    validate_learning_rules.delay()
    
    return {"status": "scheduled", "message": "Daily processing tasks queued"}

@celery_app.task
def weekly_model_optimization():
    """Weekly task for model optimization and rule cleanup"""
    logger.info("Starting weekly model optimization")
    
    # Validate all learning rules
    validate_learning_rules.delay()
    
    # Generate improvement suggestions for major services
    services = ["ai_engine", "ml_engine", "data_processor", "auto_transformation_engine"]
    
    for service in services:
        generate_improvement_suggestions.delay(service, time_period_days=7)
    
    return {"status": "scheduled", "message": "Weekly optimization tasks queued"}

# ========================= UTILITY TASKS =========================

@celery_app.task
def cleanup_old_feedback(days_to_keep: int = 90):
    """Clean up old feedback data to manage storage"""
    try:
        logger.info(f"Cleaning up feedback older than {days_to_keep} days")
        
        with get_db_session() as db:
            cutoff_date = datetime.utcnow() - timedelta(days=days_to_keep)
            
            # Delete old feedback
            deleted_count = db.query(UserFeedback).filter(
                UserFeedback.created_at < cutoff_date
            ).delete()
            
            # Delete old A/B test results
            deleted_ab_results = db.query(ABTestResult).filter(
                ABTestResult.recorded_at < cutoff_date
            ).delete()
            
            db.commit()
            
            logger.info(f"Cleaned up {deleted_count} feedback records and {deleted_ab_results} A/B test results")
            
            return {
                "status": "success",
                "deleted_feedback": deleted_count,
                "deleted_ab_results": deleted_ab_results
            }
            
    except Exception as e:
        logger.error(f"Error cleaning up old feedback: {str(e)}")
        return {"status": "error", "message": str(e)}

@celery_app.task
def export_learning_insights(export_format: str = "json"):
    """Export learning insights and patterns for analysis"""
    try:
        logger.info(f"Exporting learning insights in {export_format} format")
        
        with get_db_session() as db:
            feedback_engine = get_feedback_learning_engine()
            
            # Get learning metrics
            import asyncio
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            try:
                metrics = loop.run_until_complete(feedback_engine.get_learning_metrics())
                
                # Get top learning rules
                top_rules = db.query(LearningRule).filter(
                    LearningRule.is_active == True
                ).order_by(
                    LearningRule.confidence.desc(),
                    LearningRule.support.desc()
                ).limit(20).all()
                
                insights = {
                    "export_timestamp": datetime.utcnow().isoformat(),
                    "metrics": metrics,
                    "top_learning_rules": [
                        {
                            "rule_id": rule.rule_id,
                            "rule_type": rule.rule_type,
                            "confidence": rule.confidence,
                            "support": rule.support,
                            "effectiveness": rule.effectiveness,
                            "created_at": rule.created_at.isoformat()
                        }
                        for rule in top_rules
                    ]
                }
                
                return {
                    "status": "success",
                    "export_format": export_format,
                    "insights": insights
                }
                
            finally:
                loop.close()
                
    except Exception as e:
        logger.error(f"Error exporting learning insights: {str(e)}")
        return {"status": "error", "message": str(e)}