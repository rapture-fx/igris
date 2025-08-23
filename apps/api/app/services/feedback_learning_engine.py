"""
Comprehensive Feedback Learning Engine for Schlep-engine
Provides continuous improvement through user feedback and reinforcement learning
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional, Tuple, Union, Set
from datetime import datetime, timedelta
from collections import defaultdict, Counter
import json
import logging
import hashlib
import pickle
import asyncio
from dataclasses import dataclass, field
from enum import Enum
import warnings
from pathlib import Path

# ML imports with fallbacks
try:
    from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.cluster import KMeans, DBSCAN
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    from sklearn.preprocessing import StandardScaler, LabelEncoder
    from sklearn.model_selection import train_test_split, cross_val_score
    from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False

# Database imports
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, func
from app.database.connection import get_db
from app.database.models import User, Organization
from app.core.redis_client import get_redis_client
from app.services.core.error_handling import handle_service_error

warnings.filterwarnings('ignore')
logger = logging.getLogger(__name__)

class FeedbackType(str, Enum):
    """Types of feedback that can be collected"""
    TRANSFORMATION_RATING = "transformation_rating"
    PREDICTION_ACCURACY = "prediction_accuracy"  
    PATTERN_RELEVANCE = "pattern_relevance"
    DATA_QUALITY_IMPROVEMENT = "data_quality_improvement"
    FEATURE_USEFULNESS = "feature_usefulness"
    MODEL_PERFORMANCE = "model_performance"
    UI_EXPERIENCE = "ui_experience"
    API_SATISFACTION = "api_satisfaction"

class FeedbackSentiment(str, Enum):
    """Sentiment analysis of feedback"""
    POSITIVE = "positive"
    NEGATIVE = "negative" 
    NEUTRAL = "neutral"

class LearningStrategy(str, Enum):
    """Different learning approaches"""
    REINFORCEMENT = "reinforcement"
    SUPERVISED = "supervised"
    UNSUPERVISED = "unsupervised"
    COLLABORATIVE_FILTERING = "collaborative_filtering"
    ENSEMBLE = "ensemble"

@dataclass
class FeedbackEvent:
    """Single feedback event"""
    user_id: str
    organization_id: Optional[str]
    feedback_type: FeedbackType
    context: Dict[str, Any]  # Context of the action that generated feedback
    rating: Optional[float] = None  # 1-5 scale
    binary_feedback: Optional[bool] = None  # thumbs up/down
    text_feedback: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.utcnow)
    session_id: Optional[str] = None
    
@dataclass
class UserProfile:
    """User behavior and preference profile"""
    user_id: str
    organization_id: Optional[str]
    preferences: Dict[str, Any] = field(default_factory=dict)
    behavior_patterns: Dict[str, Any] = field(default_factory=dict)
    expertise_level: str = "intermediate"  # beginner, intermediate, advanced
    feedback_history: List[FeedbackEvent] = field(default_factory=list)
    last_updated: datetime = field(default_factory=datetime.utcnow)

@dataclass
class LearningRule:
    """Extracted learning rule from feedback patterns"""
    rule_id: str
    rule_type: str
    condition: Dict[str, Any]
    action: Dict[str, Any]
    confidence: float
    support: int  # Number of feedback events supporting this rule
    created_at: datetime = field(default_factory=datetime.utcnow)
    last_validated: datetime = field(default_factory=datetime.utcnow)

class FeedbackLearningEngine:
    """
    Comprehensive feedback learning engine that:
    1. Collects and processes user feedback
    2. Learns patterns and preferences from feedback data
    3. Continuously improves AI services based on feedback
    4. Provides personalized experiences
    5. Implements A/B testing and quality loops
    """
    
    def __init__(self, redis_client=None, db_session: Optional[Session] = None):
        """Initialize the feedback learning engine"""
        self.redis_client = redis_client or get_redis_client()
        self.db_session = db_session
        
        # Internal storage
        self.feedback_buffer: List[FeedbackEvent] = []
        self.user_profiles: Dict[str, UserProfile] = {}
        self.learning_rules: Dict[str, LearningRule] = {}
        self.model_registry: Dict[str, Any] = {}
        
        # Configuration
        self.buffer_size = 1000
        self.min_feedback_for_learning = 10
        self.confidence_threshold = 0.7
        self.rule_validation_interval = timedelta(days=7)
        
        # ML components
        if ML_AVAILABLE:
            self.feedback_classifier = GradientBoostingClassifier(n_estimators=100, random_state=42)
            self.preference_clusterer = KMeans(n_clusters=5, random_state=42)
            self.text_vectorizer = TfidfVectorizer(max_features=1000, stop_words='english')
            self.scaler = StandardScaler()
        
        # Initialize from storage
        self._load_persistent_data()
        
    # ========================= FEEDBACK COLLECTION =========================
    
    async def collect_feedback(self, feedback_event: FeedbackEvent) -> Dict[str, Any]:
        """
        Collect a feedback event and trigger learning if necessary
        
        Args:
            feedback_event: The feedback event to process
            
        Returns:
            dict: Processing result with insights
        """
        try:
            # Validate feedback event
            validated_feedback = self._validate_feedback(feedback_event)
            
            # Add to buffer
            self.feedback_buffer.append(validated_feedback)
            
            # Update user profile
            await self._update_user_profile(validated_feedback)
            
            # Store in Redis for real-time access
            await self._cache_feedback(validated_feedback)
            
            # Trigger learning if buffer is full
            if len(self.feedback_buffer) >= self.buffer_size:
                await self._trigger_learning()
            
            # Immediate insights
            insights = await self._generate_immediate_insights(validated_feedback)
            
            logger.info(f"Feedback collected for user {feedback_event.user_id}, type: {feedback_event.feedback_type}")
            
            return {
                "status": "success",
                "feedback_id": self._generate_feedback_id(validated_feedback),
                "immediate_insights": insights,
                "user_profile_updated": True
            }
            
        except Exception as e:
            logger.error(f"Error collecting feedback: {str(e)}")
            return {"status": "error", "message": str(e)}
    
    def _validate_feedback(self, feedback_event: FeedbackEvent) -> FeedbackEvent:
        """Validate and clean feedback event"""
        # Ensure required fields
        if not feedback_event.user_id:
            raise ValueError("User ID is required for feedback")
            
        # Validate rating if provided
        if feedback_event.rating is not None:
            if not (1 <= feedback_event.rating <= 5):
                raise ValueError("Rating must be between 1 and 5")
                
        # Clean and validate context
        if not isinstance(feedback_event.context, dict):
            feedback_event.context = {}
            
        # Add session tracking if missing
        if not feedback_event.session_id:
            feedback_event.session_id = self._generate_session_id(feedback_event.user_id)
            
        return feedback_event
    
    async def _cache_feedback(self, feedback_event: FeedbackEvent):
        """Cache feedback in Redis for fast access"""
        try:
            if self.redis_client:
                feedback_key = f"feedback:{feedback_event.user_id}:{feedback_event.timestamp.isoformat()}"
                feedback_data = {
                    "user_id": feedback_event.user_id,
                    "feedback_type": feedback_event.feedback_type.value,
                    "rating": feedback_event.rating,
                    "binary_feedback": feedback_event.binary_feedback,
                    "context": json.dumps(feedback_event.context),
                    "timestamp": feedback_event.timestamp.isoformat()
                }
                await self.redis_client.hset(feedback_key, mapping=feedback_data)
                await self.redis_client.expire(feedback_key, 86400 * 30)  # 30 days
                
        except Exception as e:
            logger.warning(f"Failed to cache feedback: {str(e)}")
    
    # ========================= PATTERN LEARNING =========================
    
    async def _trigger_learning(self):
        """Trigger learning process when buffer is full"""
        try:
            # Extract patterns from feedback buffer
            patterns = await self._extract_feedback_patterns()
            
            # Update learning rules
            new_rules = await self._update_learning_rules(patterns)
            
            # Train/update ML models
            if ML_AVAILABLE:
                await self._update_ml_models()
                
            # Clear buffer and persist data
            self.feedback_buffer.clear()
            await self._persist_learning_state()
            
            logger.info(f"Learning cycle completed. Generated {len(new_rules)} new rules")
            
        except Exception as e:
            logger.error(f"Error in learning process: {str(e)}")
    
    async def _extract_feedback_patterns(self) -> Dict[str, Any]:
        """Extract patterns from recent feedback data"""
        patterns = {
            "user_preferences": defaultdict(list),
            "context_patterns": defaultdict(list),
            "temporal_patterns": defaultdict(list),
            "satisfaction_patterns": defaultdict(list)
        }
        
        for feedback in self.feedback_buffer:
            # User preference patterns
            user_key = f"{feedback.user_id}:{feedback.feedback_type.value}"
            patterns["user_preferences"][user_key].append(feedback.rating or 0)
            
            # Context patterns
            for context_key, context_value in feedback.context.items():
                context_pattern = f"{context_key}:{context_value}"
                patterns["context_patterns"][context_pattern].append(feedback.rating or 0)
                
            # Temporal patterns
            hour_of_day = feedback.timestamp.hour
            day_of_week = feedback.timestamp.weekday()
            patterns["temporal_patterns"][f"hour_{hour_of_day}"].append(feedback.rating or 0)
            patterns["temporal_patterns"][f"day_{day_of_week}"].append(feedback.rating or 0)
            
            # Satisfaction patterns
            if feedback.rating is not None:
                satisfaction_level = "high" if feedback.rating >= 4 else "medium" if feedback.rating >= 3 else "low"
                patterns["satisfaction_patterns"][satisfaction_level].append(feedback)
                
        return patterns
    
    async def _update_learning_rules(self, patterns: Dict[str, Any]) -> List[LearningRule]:
        """Generate and update learning rules from patterns"""
        new_rules = []
        
        # User preference rules
        for user_type_key, ratings in patterns["user_preferences"].items():
            if len(ratings) >= self.min_feedback_for_learning:
                avg_rating = np.mean(ratings)
                confidence = min(len(ratings) / 100.0, 1.0)  # More data = higher confidence
                
                if confidence >= self.confidence_threshold:
                    rule = LearningRule(
                        rule_id=f"user_pref_{hashlib.md5(user_type_key.encode()).hexdigest()[:8]}",
                        rule_type="user_preference",
                        condition={"user_type_key": user_type_key},
                        action={"expected_rating": avg_rating, "recommendation": self._get_recommendation(avg_rating)},
                        confidence=confidence,
                        support=len(ratings)
                    )
                    new_rules.append(rule)
                    self.learning_rules[rule.rule_id] = rule
        
        # Context-based rules
        for context_pattern, ratings in patterns["context_patterns"].items():
            if len(ratings) >= self.min_feedback_for_learning:
                avg_rating = np.mean(ratings)
                confidence = min(len(ratings) / 50.0, 1.0)
                
                if confidence >= self.confidence_threshold:
                    rule = LearningRule(
                        rule_id=f"context_{hashlib.md5(context_pattern.encode()).hexdigest()[:8]}",
                        rule_type="context_based",
                        condition={"context_pattern": context_pattern},
                        action={"expected_rating": avg_rating, "optimization": self._get_context_optimization(context_pattern, avg_rating)},
                        confidence=confidence,
                        support=len(ratings)
                    )
                    new_rules.append(rule)
                    self.learning_rules[rule.rule_id] = rule
                    
        return new_rules
    
    def _get_recommendation(self, avg_rating: float) -> str:
        """Get recommendation based on average rating"""
        if avg_rating >= 4.0:
            return "maintain_current_approach"
        elif avg_rating >= 3.0:
            return "minor_improvements_needed"
        else:
            return "major_improvements_required"
    
    def _get_context_optimization(self, context_pattern: str, avg_rating: float) -> Dict[str, Any]:
        """Get context-specific optimization suggestions"""
        optimizations = {
            "priority": "high" if avg_rating < 3.0 else "medium" if avg_rating < 4.0 else "low",
            "focus_areas": []
        }
        
        if "transformation" in context_pattern.lower():
            optimizations["focus_areas"].extend(["accuracy", "speed", "user_experience"])
        elif "prediction" in context_pattern.lower():
            optimizations["focus_areas"].extend(["model_performance", "feature_selection"])
        elif "data_quality" in context_pattern.lower():
            optimizations["focus_areas"].extend(["validation_rules", "cleaning_algorithms"])
            
        return optimizations
    
    # ========================= USER MODELING =========================
    
    async def _update_user_profile(self, feedback_event: FeedbackEvent):
        """Update user profile with new feedback"""
        user_id = feedback_event.user_id
        
        if user_id not in self.user_profiles:
            self.user_profiles[user_id] = UserProfile(
                user_id=user_id,
                organization_id=feedback_event.organization_id
            )
        
        profile = self.user_profiles[user_id]
        profile.feedback_history.append(feedback_event)
        profile.last_updated = datetime.utcnow()
        
        # Update preferences
        self._update_user_preferences(profile, feedback_event)
        
        # Update behavior patterns
        self._update_behavior_patterns(profile, feedback_event)
        
        # Update expertise level
        self._update_expertise_level(profile)
        
    def _update_user_preferences(self, profile: UserProfile, feedback_event: FeedbackEvent):
        """Update user preferences based on feedback"""
        feedback_type = feedback_event.feedback_type.value
        
        if feedback_type not in profile.preferences:
            profile.preferences[feedback_type] = {
                "total_feedback": 0,
                "average_rating": 0.0,
                "preferred_contexts": Counter(),
                "satisfaction_trend": []
            }
        
        pref = profile.preferences[feedback_type]
        pref["total_feedback"] += 1
        
        if feedback_event.rating is not None:
            # Update average rating
            old_avg = pref["average_rating"]
            old_count = pref["total_feedback"] - 1
            pref["average_rating"] = (old_avg * old_count + feedback_event.rating) / pref["total_feedback"]
            
            # Update satisfaction trend
            pref["satisfaction_trend"].append({
                "rating": feedback_event.rating,
                "timestamp": feedback_event.timestamp
            })
            
            # Keep only recent trend data
            if len(pref["satisfaction_trend"]) > 100:
                pref["satisfaction_trend"] = pref["satisfaction_trend"][-100:]
        
        # Update preferred contexts
        for context_key, context_value in feedback_event.context.items():
            context_str = f"{context_key}:{context_value}"
            pref["preferred_contexts"][context_str] += 1
    
    def _update_behavior_patterns(self, profile: UserProfile, feedback_event: FeedbackEvent):
        """Update user behavior patterns"""
        if "usage_patterns" not in profile.behavior_patterns:
            profile.behavior_patterns["usage_patterns"] = {
                "active_hours": Counter(),
                "active_days": Counter(),
                "feedback_frequency": []
            }
        
        patterns = profile.behavior_patterns["usage_patterns"]
        
        # Track active hours and days
        patterns["active_hours"][feedback_event.timestamp.hour] += 1
        patterns["active_days"][feedback_event.timestamp.weekday()] += 1
        
        # Track feedback frequency
        patterns["feedback_frequency"].append(feedback_event.timestamp)
        if len(patterns["feedback_frequency"]) > 1000:
            patterns["feedback_frequency"] = patterns["feedback_frequency"][-1000:]
    
    def _update_expertise_level(self, profile: UserProfile):
        """Update user expertise level based on feedback patterns"""
        total_feedback = len(profile.feedback_history)
        
        if total_feedback < 10:
            profile.expertise_level = "beginner"
        elif total_feedback < 50:
            # Check feedback quality and consistency
            recent_feedback = profile.feedback_history[-20:]
            detailed_feedback_count = sum(1 for f in recent_feedback if f.text_feedback)
            
            if detailed_feedback_count >= 10:
                profile.expertise_level = "advanced"
            else:
                profile.expertise_level = "intermediate"
        else:
            # Advanced users provide consistent, detailed feedback
            recent_feedback = profile.feedback_history[-50:]
            detailed_feedback_ratio = sum(1 for f in recent_feedback if f.text_feedback) / len(recent_feedback)
            
            if detailed_feedback_ratio >= 0.3:
                profile.expertise_level = "advanced"
            else:
                profile.expertise_level = "intermediate"
    
    # ========================= CONTINUOUS IMPROVEMENT =========================
    
    async def get_improvement_suggestions(self, service_name: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Get improvement suggestions for AI services based on feedback"""
        try:
            suggestions = {
                "service": service_name,
                "priority_improvements": [],
                "user_specific_optimizations": [],
                "context_optimizations": [],
                "confidence": 0.0
            }
            
            # Analyze relevant learning rules
            relevant_rules = self._get_relevant_rules(service_name, context)
            
            for rule in relevant_rules:
                if rule.rule_type == "user_preference":
                    suggestions["user_specific_optimizations"].append({
                        "rule_id": rule.rule_id,
                        "recommendation": rule.action.get("recommendation"),
                        "confidence": rule.confidence
                    })
                elif rule.rule_type == "context_based":
                    suggestions["context_optimizations"].append({
                        "rule_id": rule.rule_id,
                        "optimization": rule.action.get("optimization"),
                        "confidence": rule.confidence
                    })
            
            # Generate priority improvements
            suggestions["priority_improvements"] = await self._generate_priority_improvements(service_name)
            
            # Calculate overall confidence
            if relevant_rules:
                suggestions["confidence"] = np.mean([rule.confidence for rule in relevant_rules])
            
            return suggestions
            
        except Exception as e:
            logger.error(f"Error generating improvement suggestions: {str(e)}")
            return {"service": service_name, "error": str(e)}
    
    def _get_relevant_rules(self, service_name: str, context: Dict[str, Any]) -> List[LearningRule]:
        """Get learning rules relevant to the service and context"""
        relevant_rules = []
        
        for rule in self.learning_rules.values():
            # Check if rule is relevant to the service
            if self._is_rule_relevant(rule, service_name, context):
                relevant_rules.append(rule)
        
        # Sort by confidence and recency
        relevant_rules.sort(key=lambda r: (r.confidence, r.last_validated), reverse=True)
        return relevant_rules[:10]  # Top 10 most relevant rules
    
    def _is_rule_relevant(self, rule: LearningRule, service_name: str, context: Dict[str, Any]) -> bool:
        """Check if a learning rule is relevant to the current service and context"""
        # Check service relevance
        if service_name.lower() in str(rule.condition).lower():
            return True
            
        # Check context overlap
        rule_context = rule.condition.get("context_pattern", "")
        for context_key, context_value in context.items():
            if f"{context_key}:{context_value}" in rule_context:
                return True
                
        return False
    
    async def _generate_priority_improvements(self, service_name: str) -> List[Dict[str, Any]]:
        """Generate priority improvements based on feedback analysis"""
        improvements = []
        
        # Analyze feedback for the specific service
        service_feedback = [
            f for f in self.feedback_buffer
            if service_name.lower() in str(f.context).lower()
        ]
        
        if not service_feedback:
            return improvements
        
        # Identify areas with lowest satisfaction
        low_satisfaction_areas = defaultdict(list)
        for feedback in service_feedback:
            if feedback.rating is not None and feedback.rating < 3:
                feedback_type = feedback.feedback_type.value
                low_satisfaction_areas[feedback_type].append(feedback)
        
        # Generate improvements for low satisfaction areas
        for area, feedback_list in low_satisfaction_areas.items():
            if len(feedback_list) >= 3:  # Minimum threshold
                improvements.append({
                    "area": area,
                    "priority": "high",
                    "frequency": len(feedback_list),
                    "avg_rating": np.mean([f.rating for f in feedback_list if f.rating]),
                    "recommendations": self._get_area_recommendations(area, feedback_list)
                })
        
        # Sort by priority and frequency
        improvements.sort(key=lambda x: (-x["frequency"], x["avg_rating"]))
        return improvements[:5]  # Top 5 priority improvements
    
    def _get_area_recommendations(self, area: str, feedback_list: List[FeedbackEvent]) -> List[str]:
        """Get specific recommendations for improvement area"""
        recommendations = []
        
        # Analyze text feedback for common themes
        text_feedback = [f.text_feedback for f in feedback_list if f.text_feedback]
        
        if area == "transformation_rating":
            recommendations.extend([
                "Improve data transformation accuracy",
                "Optimize transformation speed",
                "Enhance user interface for transformations"
            ])
        elif area == "prediction_accuracy":
            recommendations.extend([
                "Retrain prediction models with recent data",
                "Improve feature engineering",
                "Implement ensemble methods"
            ])
        elif area == "data_quality_improvement":
            recommendations.extend([
                "Enhance data validation rules",
                "Improve outlier detection",
                "Better handling of missing values"
            ])
        
        # Add text-based insights if available
        if text_feedback:
            # Simple keyword analysis
            common_words = Counter()
            for text in text_feedback:
                words = text.lower().split()
                common_words.update(words)
            
            # Add insights based on common complaints
            for word, count in common_words.most_common(5):
                if word in ["slow", "speed", "performance"]:
                    recommendations.append("Optimize processing speed")
                elif word in ["accuracy", "wrong", "incorrect"]:
                    recommendations.append("Improve result accuracy")
                elif word in ["interface", "ui", "experience"]:
                    recommendations.append("Enhance user interface")
        
        return list(set(recommendations))  # Remove duplicates
    
    # ========================= A/B TESTING AND QUALITY LOOPS =========================
    
    async def setup_ab_test(self, test_name: str, variants: List[Dict[str, Any]], 
                           success_metric: str, duration_days: int = 7) -> str:
        """Set up A/B test for continuous improvement"""
        try:
            test_id = f"ab_test_{hashlib.md5(test_name.encode()).hexdigest()[:8]}"
            
            ab_test = {
                "test_id": test_id,
                "test_name": test_name,
                "variants": variants,
                "success_metric": success_metric,
                "start_time": datetime.utcnow(),
                "end_time": datetime.utcnow() + timedelta(days=duration_days),
                "status": "active",
                "results": {variant["name"]: {"feedback": [], "metrics": {}} for variant in variants}
            }
            
            # Cache test configuration
            if self.redis_client:
                await self.redis_client.set(f"ab_test:{test_id}", json.dumps(ab_test, default=str))
                await self.redis_client.expire(f"ab_test:{test_id}", 86400 * (duration_days + 1))
            
            logger.info(f"A/B test setup: {test_name} (ID: {test_id})")
            return test_id
            
        except Exception as e:
            logger.error(f"Error setting up A/B test: {str(e)}")
            raise
    
    async def record_ab_test_feedback(self, test_id: str, variant_name: str, 
                                     user_id: str, metric_value: float, 
                                     context: Dict[str, Any]) -> bool:
        """Record feedback for A/B test variant"""
        try:
            # Get test configuration
            if not self.redis_client:
                return False
                
            test_data = await self.redis_client.get(f"ab_test:{test_id}")
            if not test_data:
                logger.warning(f"A/B test not found: {test_id}")
                return False
            
            ab_test = json.loads(test_data)
            
            # Check if test is still active
            end_time = datetime.fromisoformat(ab_test["end_time"])
            if datetime.utcnow() > end_time:
                logger.info(f"A/B test expired: {test_id}")
                return False
            
            # Record feedback
            feedback_entry = {
                "user_id": user_id,
                "metric_value": metric_value,
                "context": context,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            ab_test["results"][variant_name]["feedback"].append(feedback_entry)
            
            # Update cached test data
            await self.redis_client.set(f"ab_test:{test_id}", json.dumps(ab_test, default=str))
            
            return True
            
        except Exception as e:
            logger.error(f"Error recording A/B test feedback: {str(e)}")
            return False
    
    async def analyze_ab_test_results(self, test_id: str) -> Dict[str, Any]:
        """Analyze A/B test results and determine winner"""
        try:
            if not self.redis_client:
                return {"error": "Redis not available"}
                
            test_data = await self.redis_client.get(f"ab_test:{test_id}")
            if not test_data:
                return {"error": "Test not found"}
            
            ab_test = json.loads(test_data)
            results = ab_test["results"]
            success_metric = ab_test["success_metric"]
            
            analysis = {
                "test_id": test_id,
                "test_name": ab_test["test_name"],
                "status": ab_test["status"],
                "variant_results": {},
                "winner": None,
                "confidence": 0.0,
                "recommendation": "insufficient_data"
            }
            
            # Analyze each variant
            variant_metrics = {}
            for variant_name, variant_data in results.items():
                feedback = variant_data["feedback"]
                
                if feedback:
                    metric_values = [f["metric_value"] for f in feedback]
                    variant_metrics[variant_name] = {
                        "count": len(feedback),
                        "mean": np.mean(metric_values),
                        "std": np.std(metric_values),
                        "median": np.median(metric_values)
                    }
                    
                    analysis["variant_results"][variant_name] = variant_metrics[variant_name]
            
            # Determine winner if we have enough data
            if len(variant_metrics) >= 2:
                # Find best performing variant
                best_variant = max(variant_metrics.items(), 
                                 key=lambda x: x[1]["mean"])
                
                analysis["winner"] = best_variant[0]
                analysis["confidence"] = min(best_variant[1]["count"] / 100.0, 1.0)
                
                if analysis["confidence"] >= 0.8:
                    analysis["recommendation"] = "deploy_winner"
                elif analysis["confidence"] >= 0.5:
                    analysis["recommendation"] = "continue_testing"
                else:
                    analysis["recommendation"] = "insufficient_data"
            
            return analysis
            
        except Exception as e:
            logger.error(f"Error analyzing A/B test results: {str(e)}")
            return {"error": str(e)}
    
    # ========================= AI INTEGRATION =========================
    
    async def enhance_ai_service_call(self, service_name: str, user_id: str, 
                                    original_params: Dict[str, Any]) -> Dict[str, Any]:
        """Enhance AI service calls based on learned user preferences and patterns"""
        try:
            enhanced_params = original_params.copy()
            
            # Get user profile if available
            user_profile = self.user_profiles.get(user_id)
            if not user_profile:
                return enhanced_params
            
            # Apply user-specific enhancements
            enhancements = self._get_user_specific_enhancements(service_name, user_profile)
            enhanced_params.update(enhancements)
            
            # Apply context-based optimizations
            context_enhancements = self._get_context_enhancements(service_name, original_params)
            enhanced_params.update(context_enhancements)
            
            logger.info(f"Enhanced {service_name} call for user {user_id}")
            return enhanced_params
            
        except Exception as e:
            logger.error(f"Error enhancing AI service call: {str(e)}")
            return original_params
    
    def _get_user_specific_enhancements(self, service_name: str, user_profile: UserProfile) -> Dict[str, Any]:
        """Get user-specific parameter enhancements"""
        enhancements = {}
        
        # Check user preferences for this service type
        service_preferences = user_profile.preferences.get(f"{service_name}_preferences", {})
        
        if service_preferences:
            # Adjust based on user's typical satisfaction levels
            avg_rating = service_preferences.get("average_rating", 3.0)
            
            if avg_rating < 3.0:
                # User typically unsatisfied - use more conservative/accurate settings
                enhancements.update({
                    "confidence_threshold": 0.8,  # Higher threshold for more confident results
                    "validation_level": "strict",
                    "processing_mode": "accurate"
                })
            elif avg_rating > 4.0:
                # User typically satisfied - can use faster settings
                enhancements.update({
                    "confidence_threshold": 0.6,
                    "validation_level": "standard", 
                    "processing_mode": "balanced"
                })
        
        # Adjust based on user expertise level
        if user_profile.expertise_level == "beginner":
            enhancements.update({
                "explanation_level": "detailed",
                "include_suggestions": True,
                "safety_checks": "enabled"
            })
        elif user_profile.expertise_level == "advanced":
            enhancements.update({
                "explanation_level": "minimal",
                "include_raw_metrics": True,
                "allow_experimental": True
            })
        
        return enhancements
    
    def _get_context_enhancements(self, service_name: str, original_params: Dict[str, Any]) -> Dict[str, Any]:
        """Get context-based enhancements from learning rules"""
        enhancements = {}
        
        # Find relevant context-based rules
        for rule in self.learning_rules.values():
            if rule.rule_type == "context_based" and rule.confidence >= self.confidence_threshold:
                # Check if rule applies to current context
                context_pattern = rule.condition.get("context_pattern", "")
                
                # Simple pattern matching
                for param_key, param_value in original_params.items():
                    if f"{param_key}:{param_value}" in context_pattern:
                        # Apply rule optimization
                        optimization = rule.action.get("optimization", {})
                        if optimization.get("priority") == "high":
                            enhancements.update({
                                "priority_processing": True,
                                "enhanced_validation": True
                            })
        
        return enhancements
    
    # ========================= UTILITY METHODS =========================
    
    async def get_user_insights(self, user_id: str) -> Dict[str, Any]:
        """Get comprehensive insights about a user's behavior and preferences"""
        try:
            user_profile = self.user_profiles.get(user_id)
            if not user_profile:
                return {"error": "User profile not found"}
            
            insights = {
                "user_id": user_id,
                "expertise_level": user_profile.expertise_level,
                "total_feedback": len(user_profile.feedback_history),
                "preferences": user_profile.preferences,
                "behavior_patterns": user_profile.behavior_patterns,
                "satisfaction_trends": {},
                "recommendations": []
            }
            
            # Calculate satisfaction trends
            for feedback_type, pref_data in user_profile.preferences.items():
                satisfaction_trend = pref_data.get("satisfaction_trend", [])
                if satisfaction_trend:
                    recent_ratings = [t["rating"] for t in satisfaction_trend[-10:]]
                    insights["satisfaction_trends"][feedback_type] = {
                        "current_avg": np.mean(recent_ratings),
                        "trend": "improving" if len(recent_ratings) > 1 and recent_ratings[-1] > recent_ratings[0] else "stable"
                    }
            
            # Generate personalized recommendations
            insights["recommendations"] = self._generate_user_recommendations(user_profile)
            
            return insights
            
        except Exception as e:
            logger.error(f"Error getting user insights: {str(e)}")
            return {"error": str(e)}
    
    def _generate_user_recommendations(self, user_profile: UserProfile) -> List[str]:
        """Generate personalized recommendations for a user"""
        recommendations = []
        
        # Analyze feedback patterns
        low_satisfaction_areas = []
        for feedback_type, pref_data in user_profile.preferences.items():
            if pref_data.get("average_rating", 0) < 3.0:
                low_satisfaction_areas.append(feedback_type)
        
        if low_satisfaction_areas:
            recommendations.append(f"Focus on improving: {', '.join(low_satisfaction_areas)}")
        
        # Expertise-based recommendations
        if user_profile.expertise_level == "beginner":
            recommendations.append("Consider using guided mode for better results")
        elif user_profile.expertise_level == "advanced":
            recommendations.append("Try advanced features and experimental options")
        
        # Usage pattern recommendations
        behavior = user_profile.behavior_patterns.get("usage_patterns", {})
        active_hours = behavior.get("active_hours", {})
        
        if active_hours:
            peak_hour = max(active_hours.items(), key=lambda x: x[1])[0]
            recommendations.append(f"You're most active around {peak_hour}:00 - consider scheduling intensive tasks then")
        
        return recommendations
    
    def _generate_feedback_id(self, feedback_event: FeedbackEvent) -> str:
        """Generate unique ID for feedback event"""
        content = f"{feedback_event.user_id}_{feedback_event.timestamp.isoformat()}_{feedback_event.feedback_type.value}"
        return hashlib.md5(content.encode()).hexdigest()[:16]
    
    def _generate_session_id(self, user_id: str) -> str:
        """Generate session ID for user"""
        content = f"{user_id}_{datetime.utcnow().isoformat()}"
        return hashlib.md5(content.encode()).hexdigest()[:12]
    
    # ========================= PERSISTENCE =========================
    
    def _load_persistent_data(self):
        """Load persistent learning data from storage"""
        try:
            # In production, this would load from database
            # For now, we use Redis for caching
            pass
        except Exception as e:
            logger.warning(f"Failed to load persistent data: {str(e)}")
    
    async def _persist_learning_state(self):
        """Persist current learning state"""
        try:
            if self.redis_client:
                # Save learning rules
                rules_data = {
                    rule_id: {
                        "rule_type": rule.rule_type,
                        "condition": rule.condition,
                        "action": rule.action,
                        "confidence": rule.confidence,
                        "support": rule.support,
                        "created_at": rule.created_at.isoformat(),
                        "last_validated": rule.last_validated.isoformat()
                    }
                    for rule_id, rule in self.learning_rules.items()
                }
                
                await self.redis_client.set("learning_rules", json.dumps(rules_data))
                await self.redis_client.expire("learning_rules", 86400 * 30)  # 30 days
                
                # Save user profiles (summary only for privacy)
                profiles_summary = {
                    user_id: {
                        "expertise_level": profile.expertise_level,
                        "total_feedback": len(profile.feedback_history),
                        "last_updated": profile.last_updated.isoformat()
                    }
                    for user_id, profile in self.user_profiles.items()
                }
                
                await self.redis_client.set("user_profiles_summary", json.dumps(profiles_summary))
                await self.redis_client.expire("user_profiles_summary", 86400 * 7)  # 7 days
                
        except Exception as e:
            logger.error(f"Failed to persist learning state: {str(e)}")
    
    # ========================= MONITORING AND METRICS =========================
    
    async def get_learning_metrics(self) -> Dict[str, Any]:
        """Get comprehensive metrics about the learning system"""
        try:
            metrics = {
                "feedback_stats": {
                    "total_feedback_events": len(self.feedback_buffer),
                    "unique_users": len(set(f.user_id for f in self.feedback_buffer)),
                    "feedback_types": dict(Counter(f.feedback_type.value for f in self.feedback_buffer))
                },
                "learning_rules": {
                    "total_rules": len(self.learning_rules),
                    "rule_types": dict(Counter(r.rule_type for r in self.learning_rules.values())),
                    "average_confidence": np.mean([r.confidence for r in self.learning_rules.values()]) if self.learning_rules else 0
                },
                "user_profiles": {
                    "total_profiles": len(self.user_profiles),
                    "expertise_distribution": dict(Counter(p.expertise_level for p in self.user_profiles.values())),
                    "active_users_last_24h": len([p for p in self.user_profiles.values() 
                                                if (datetime.utcnow() - p.last_updated).days < 1])
                },
                "system_health": {
                    "ml_available": ML_AVAILABLE,
                    "redis_connected": self.redis_client is not None,
                    "buffer_utilization": len(self.feedback_buffer) / self.buffer_size
                }
            }
            
            return metrics
            
        except Exception as e:
            logger.error(f"Error getting learning metrics: {str(e)}")
            return {"error": str(e)}

# ========================= INTEGRATION HELPERS =========================

def create_feedback_learning_engine() -> FeedbackLearningEngine:
    """Create and initialize a feedback learning engine instance"""
    try:
        redis_client = get_redis_client()
        return FeedbackLearningEngine(redis_client=redis_client)
    except Exception as e:
        logger.error(f"Failed to create feedback learning engine: {str(e)}")
        return FeedbackLearningEngine()  # Fallback without Redis

# Global instance
feedback_engine = None

def get_feedback_learning_engine() -> FeedbackLearningEngine:
    """Get global feedback learning engine instance"""
    global feedback_engine
    if feedback_engine is None:
        feedback_engine = create_feedback_learning_engine()
    return feedback_engine

# ========================= TESTING AND VALIDATION =========================

async def generate_test_feedback(num_events: int = 100) -> List[FeedbackEvent]:
    """Generate test feedback events for development and testing"""
    test_feedback = []
    
    users = [f"user_{i}" for i in range(10)]
    feedback_types = list(FeedbackType)
    
    for i in range(num_events):
        user_id = np.random.choice(users)
        feedback_type = np.random.choice(feedback_types)
        rating = np.random.choice([1, 2, 3, 4, 5], p=[0.1, 0.15, 0.3, 0.35, 0.1])
        
        context = {
            "service_name": np.random.choice(["ai_engine", "ml_engine", "data_processor"]),
            "operation": np.random.choice(["transform", "predict", "analyze", "validate"]),
            "data_size": np.random.randint(100, 10000),
            "processing_time": np.random.uniform(0.1, 10.0)
        }
        
        feedback_event = FeedbackEvent(
            user_id=user_id,
            organization_id=f"org_{user_id.split('_')[1]}",
            feedback_type=feedback_type,
            context=context,
            rating=rating,
            timestamp=datetime.utcnow() - timedelta(days=np.random.randint(0, 30))
        )
        
        test_feedback.append(feedback_event)
    
    return test_feedback

if __name__ == "__main__":
    # Example usage and testing
    async def main():
        # Initialize engine
        engine = FeedbackLearningEngine()
        
        # Generate and process test feedback
        test_events = await generate_test_feedback(50)
        
        for event in test_events:
            result = await engine.collect_feedback(event)
            print(f"Processed feedback: {result['status']}")
        
        # Get learning metrics
        metrics = await engine.get_learning_metrics()
        print(f"Learning metrics: {json.dumps(metrics, indent=2)}")
        
        # Get improvement suggestions
        suggestions = await engine.get_improvement_suggestions("ai_engine", {"operation": "transform"})
        print(f"Improvement suggestions: {json.dumps(suggestions, indent=2)}")
    
    # Run test
    # asyncio.run(main())