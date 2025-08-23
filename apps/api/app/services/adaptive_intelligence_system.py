"""
Adaptive Intelligence System - Master AI Coordinator

This system provides intelligence that gets better over time through meta-learning,
collective intelligence, and self-improving algorithms. It orchestrates and optimizes
all AI services across the platform.
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple, Union, Set
from dataclasses import dataclass, asdict
from collections import defaultdict, deque
import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.cluster import DBSCAN
from sklearn.decomposition import PCA
from sklearn.ensemble import RandomForestRegressor
import networkx as nx
import pickle
import hashlib
from enum import Enum
import redis
from celery import current_app

logger = logging.getLogger(__name__)


class LearningStrategy(Enum):
    """Enumeration of learning strategies"""
    SUPERVISED = "supervised"
    UNSUPERVISED = "unsupervised"
    REINFORCEMENT = "reinforcement"
    META_LEARNING = "meta_learning"
    TRANSFER_LEARNING = "transfer_learning"
    FEW_SHOT = "few_shot"
    ACTIVE_LEARNING = "active_learning"


class ProblemType(Enum):
    """Enumeration of problem types"""
    CLASSIFICATION = "classification"
    REGRESSION = "regression"
    CLUSTERING = "clustering"
    ANOMALY_DETECTION = "anomaly_detection"
    NLP = "nlp"
    COMPUTER_VISION = "computer_vision"
    TIME_SERIES = "time_series"
    RECOMMENDATION = "recommendation"
    OPTIMIZATION = "optimization"


@dataclass
class LearningTask:
    """Represents a learning task with metadata"""
    task_id: str
    problem_type: ProblemType
    domain: str
    data_characteristics: Dict[str, Any]
    performance_metrics: Dict[str, float]
    strategy_used: LearningStrategy
    execution_time: float
    timestamp: datetime
    user_id: Optional[str] = None
    organization_id: Optional[str] = None
    success: bool = True
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class KnowledgePattern:
    """Represents a learned pattern in the knowledge base"""
    pattern_id: str
    problem_signature: str
    successful_strategies: List[LearningStrategy]
    performance_bounds: Dict[str, Tuple[float, float]]
    confidence_score: float
    usage_count: int
    last_updated: datetime
    domain_tags: Set[str]
    similarity_threshold: float = 0.8


@dataclass
class PerformanceContext:
    """Context for performance evaluation and improvement"""
    service_id: str
    performance_history: deque
    current_strategy: LearningStrategy
    adaptation_rate: float
    last_improvement: datetime
    plateau_detection: bool = False
    exploration_factor: float = 0.1


class MetaLearningFramework:
    """Meta-learning framework for learning how to learn"""
    
    def __init__(self, redis_client: redis.Redis):
        self.redis_client = redis_client
        self.task_history: List[LearningTask] = []
        self.strategy_performance: Dict[str, Dict[str, List[float]]] = defaultdict(lambda: defaultdict(list))
        self.meta_model = RandomForestRegressor(n_estimators=100, random_state=42)
        self.is_trained = False
        
    def add_task(self, task: LearningTask) -> None:
        """Add a completed learning task to the history"""
        self.task_history.append(task)
        
        # Update strategy performance tracking
        problem_key = f"{task.problem_type.value}_{task.domain}"
        for metric, value in task.performance_metrics.items():
            self.strategy_performance[problem_key][task.strategy_used.value].append(value)
        
        # Store in Redis for persistence
        task_key = f"meta_learning:task:{task.task_id}"
        self.redis_client.setex(task_key, 86400 * 30, json.dumps(asdict(task), default=str))
        
        # Trigger retraining if we have enough data
        if len(self.task_history) % 50 == 0:
            self._retrain_meta_model()
    
    def predict_best_strategy(self, problem_type: ProblemType, domain: str, 
                            data_characteristics: Dict[str, Any]) -> Tuple[LearningStrategy, float]:
        """Predict the best learning strategy for a given problem"""
        if not self.is_trained:
            return LearningStrategy.SUPERVISED, 0.5  # Default fallback
        
        # Encode problem characteristics as feature vector
        features = self._encode_problem_features(problem_type, domain, data_characteristics)
        
        # Predict performance for each strategy
        strategy_scores = {}
        for strategy in LearningStrategy:
            strategy_features = np.append(features, [strategy.value == s.value for s in LearningStrategy])
            predicted_performance = self.meta_model.predict([strategy_features])[0]
            strategy_scores[strategy] = predicted_performance
        
        # Return best strategy with confidence
        best_strategy = max(strategy_scores, key=strategy_scores.get)
        confidence = strategy_scores[best_strategy] / sum(strategy_scores.values())
        
        return best_strategy, confidence
    
    def get_few_shot_examples(self, problem_type: ProblemType, domain: str, 
                            k: int = 5) -> List[LearningTask]:
        """Get few-shot learning examples for a problem type"""
        similar_tasks = [
            task for task in self.task_history
            if task.problem_type == problem_type and task.domain == domain and task.success
        ]
        
        # Sort by performance and return top k
        similar_tasks.sort(key=lambda x: max(x.performance_metrics.values()), reverse=True)
        return similar_tasks[:k]
    
    def _encode_problem_features(self, problem_type: ProblemType, domain: str,
                               data_characteristics: Dict[str, Any]) -> np.ndarray:
        """Encode problem characteristics into feature vector"""
        features = []
        
        # Problem type one-hot encoding
        features.extend([problem_type.value == pt.value for pt in ProblemType])
        
        # Domain hash (simple approach)
        domain_hash = hash(domain) % 100
        features.append(domain_hash)
        
        # Data characteristics
        features.append(data_characteristics.get('sample_size', 1000))
        features.append(data_characteristics.get('feature_count', 10))
        features.append(data_characteristics.get('class_balance', 0.5))
        features.append(data_characteristics.get('noise_level', 0.1))
        features.append(data_characteristics.get('complexity_score', 0.5))
        
        return np.array(features)
    
    def _retrain_meta_model(self) -> None:
        """Retrain the meta-learning model with accumulated data"""
        if len(self.task_history) < 10:
            return
        
        X, y = [], []
        for task in self.task_history:
            if task.success and task.performance_metrics:
                features = self._encode_problem_features(
                    task.problem_type, task.domain, task.data_characteristics
                )
                strategy_features = np.append(
                    features, [task.strategy_used.value == s.value for s in LearningStrategy]
                )
                X.append(strategy_features)
                y.append(max(task.performance_metrics.values()))
        
        if len(X) > 10:
            self.meta_model.fit(X, y)
            self.is_trained = True
            logger.info(f"Meta-learning model retrained with {len(X)} examples")


class CollectiveIntelligence:
    """Collective intelligence system for cross-user learning"""
    
    def __init__(self, redis_client: redis.Redis):
        self.redis_client = redis_client
        self.pattern_db: Dict[str, KnowledgePattern] = {}
        self.similarity_threshold = 0.8
        
    def contribute_experience(self, task: LearningTask) -> None:
        """Contribute a learning experience to collective intelligence"""
        # Generate problem signature
        problem_signature = self._generate_problem_signature(task)
        
        # Check if similar pattern exists
        similar_pattern = self._find_similar_pattern(problem_signature, task)
        
        if similar_pattern:
            self._update_existing_pattern(similar_pattern, task)
        else:
            self._create_new_pattern(task)
        
        # Store anonymized data for cross-organizational learning
        if task.success:
            self._store_best_practice(task)
    
    def get_recommendations(self, problem_type: ProblemType, domain: str,
                          data_characteristics: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Get recommendations based on collective intelligence"""
        problem_signature = self._generate_problem_signature_from_params(
            problem_type, domain, data_characteristics
        )
        
        recommendations = []
        for pattern in self.pattern_db.values():
            similarity = self._calculate_similarity(problem_signature, pattern.problem_signature)
            
            if similarity >= self.similarity_threshold:
                recommendations.append({
                    'pattern_id': pattern.pattern_id,
                    'strategies': pattern.successful_strategies,
                    'expected_performance': pattern.performance_bounds,
                    'confidence': pattern.confidence_score,
                    'similarity': similarity,
                    'usage_count': pattern.usage_count
                })
        
        # Sort by similarity and confidence
        recommendations.sort(key=lambda x: x['similarity'] * x['confidence'], reverse=True)
        return recommendations
    
    def identify_best_practices(self, domain: str) -> List[Dict[str, Any]]:
        """Identify best practices across the platform for a domain"""
        domain_patterns = [
            pattern for pattern in self.pattern_db.values()
            if domain in pattern.domain_tags
        ]
        
        # Rank patterns by performance and usage
        best_practices = []
        for pattern in domain_patterns:
            if pattern.usage_count >= 5:  # Minimum usage threshold
                avg_performance = np.mean([
                    np.mean(bounds) for bounds in pattern.performance_bounds.values()
                ])
                best_practices.append({
                    'pattern': pattern,
                    'avg_performance': avg_performance,
                    'reliability': pattern.confidence_score
                })
        
        best_practices.sort(key=lambda x: x['avg_performance'] * x['reliability'], reverse=True)
        return best_practices[:10]  # Top 10 best practices
    
    def _generate_problem_signature(self, task: LearningTask) -> str:
        """Generate a signature for a learning task"""
        signature_data = {
            'problem_type': task.problem_type.value,
            'domain': task.domain,
            'data_size_bucket': self._get_size_bucket(task.data_characteristics.get('sample_size', 0)),
            'feature_count_bucket': self._get_size_bucket(task.data_characteristics.get('feature_count', 0)),
            'complexity': task.data_characteristics.get('complexity_score', 0.5)
        }
        return hashlib.md5(json.dumps(signature_data, sort_keys=True).encode()).hexdigest()
    
    def _generate_problem_signature_from_params(self, problem_type: ProblemType, 
                                              domain: str, data_characteristics: Dict[str, Any]) -> str:
        """Generate problem signature from parameters"""
        signature_data = {
            'problem_type': problem_type.value,
            'domain': domain,
            'data_size_bucket': self._get_size_bucket(data_characteristics.get('sample_size', 0)),
            'feature_count_bucket': self._get_size_bucket(data_characteristics.get('feature_count', 0)),
            'complexity': data_characteristics.get('complexity_score', 0.5)
        }
        return hashlib.md5(json.dumps(signature_data, sort_keys=True).encode()).hexdigest()
    
    def _get_size_bucket(self, size: int) -> str:
        """Bucket sizes for generalization"""
        if size < 100:
            return "small"
        elif size < 10000:
            return "medium"
        elif size < 1000000:
            return "large"
        else:
            return "very_large"
    
    def _find_similar_pattern(self, signature: str, task: LearningTask) -> Optional[KnowledgePattern]:
        """Find similar existing pattern"""
        for pattern in self.pattern_db.values():
            if self._calculate_similarity(signature, pattern.problem_signature) >= self.similarity_threshold:
                return pattern
        return None
    
    def _calculate_similarity(self, sig1: str, sig2: str) -> float:
        """Calculate similarity between problem signatures"""
        # Simple Jaccard similarity for now
        set1 = set(sig1)
        set2 = set(sig2)
        intersection = len(set1 & set2)
        union = len(set1 | set2)
        return intersection / union if union > 0 else 0
    
    def _update_existing_pattern(self, pattern: KnowledgePattern, task: LearningTask) -> None:
        """Update existing knowledge pattern"""
        pattern.usage_count += 1
        pattern.last_updated = datetime.now()
        
        # Update successful strategies
        if task.success and task.strategy_used not in pattern.successful_strategies:
            pattern.successful_strategies.append(task.strategy_used)
        
        # Update performance bounds
        for metric, value in task.performance_metrics.items():
            if metric in pattern.performance_bounds:
                current_min, current_max = pattern.performance_bounds[metric]
                pattern.performance_bounds[metric] = (
                    min(current_min, value),
                    max(current_max, value)
                )
            else:
                pattern.performance_bounds[metric] = (value, value)
        
        # Update confidence score
        pattern.confidence_score = min(1.0, pattern.confidence_score + 0.1)
    
    def _create_new_pattern(self, task: LearningTask) -> None:
        """Create new knowledge pattern"""
        pattern = KnowledgePattern(
            pattern_id=f"pattern_{len(self.pattern_db)}_{datetime.now().timestamp()}",
            problem_signature=self._generate_problem_signature(task),
            successful_strategies=[task.strategy_used] if task.success else [],
            performance_bounds={metric: (value, value) for metric, value in task.performance_metrics.items()},
            confidence_score=0.5,
            usage_count=1,
            last_updated=datetime.now(),
            domain_tags={task.domain}
        )
        self.pattern_db[pattern.pattern_id] = pattern
    
    def _store_best_practice(self, task: LearningTask) -> None:
        """Store anonymized best practice"""
        best_practice_key = f"best_practice:{task.domain}:{task.problem_type.value}"
        best_practice = {
            'strategy': task.strategy_used.value,
            'performance': task.performance_metrics,
            'data_characteristics': task.data_characteristics,
            'timestamp': task.timestamp.isoformat()
        }
        self.redis_client.lpush(best_practice_key, json.dumps(best_practice, default=str))
        self.redis_client.ltrim(best_practice_key, 0, 99)  # Keep top 100


class SelfImprovingAlgorithms:
    """Self-improving algorithm system"""
    
    def __init__(self, redis_client: redis.Redis):
        self.redis_client = redis_client
        self.service_contexts: Dict[str, PerformanceContext] = {}
        self.algorithm_pool = {
            LearningStrategy.SUPERVISED: ['random_forest', 'svm', 'neural_network', 'gradient_boosting'],
            LearningStrategy.UNSUPERVISED: ['kmeans', 'dbscan', 'hierarchical', 'gaussian_mixture'],
            LearningStrategy.REINFORCEMENT: ['q_learning', 'policy_gradient', 'actor_critic', 'ddpg']
        }
        
    def register_service(self, service_id: str, initial_strategy: LearningStrategy) -> None:
        """Register a service for self-improvement tracking"""
        self.service_contexts[service_id] = PerformanceContext(
            service_id=service_id,
            performance_history=deque(maxlen=100),
            current_strategy=initial_strategy,
            adaptation_rate=0.1,
            last_improvement=datetime.now(),
            exploration_factor=0.1
        )
    
    def update_performance(self, service_id: str, performance_score: float, 
                         execution_time: float) -> bool:
        """Update performance for a service and determine if adaptation is needed"""
        if service_id not in self.service_contexts:
            return False
        
        context = self.service_contexts[service_id]
        context.performance_history.append({
            'score': performance_score,
            'time': execution_time,
            'timestamp': datetime.now(),
            'strategy': context.current_strategy
        })
        
        # Check if adaptation is needed
        should_adapt = self._should_adapt(context)
        if should_adapt:
            new_strategy = self._select_new_strategy(context)
            if new_strategy != context.current_strategy:
                context.current_strategy = new_strategy
                context.last_improvement = datetime.now()
                logger.info(f"Service {service_id} adapted to strategy: {new_strategy}")
                return True
        
        return False
    
    def get_current_strategy(self, service_id: str) -> Optional[LearningStrategy]:
        """Get current strategy for a service"""
        return self.service_contexts.get(service_id, {}).current_strategy
    
    def evolutionary_improvement(self, service_id: str) -> Dict[str, Any]:
        """Apply evolutionary algorithm improvement"""
        if service_id not in self.service_contexts:
            return {}
        
        context = self.service_contexts[service_id]
        
        # Generate strategy mutations
        current_performance = self._get_recent_performance(context)
        mutations = self._generate_strategy_mutations(context.current_strategy)
        
        improvement_plan = {
            'current_strategy': context.current_strategy.value,
            'current_performance': current_performance,
            'mutations': mutations,
            'recommended_experiments': len(mutations)
        }
        
        return improvement_plan
    
    def _should_adapt(self, context: PerformanceContext) -> bool:
        """Determine if adaptation is needed based on performance history"""
        if len(context.performance_history) < 10:
            return False
        
        recent_scores = [entry['score'] for entry in list(context.performance_history)[-10:]]
        older_scores = [entry['score'] for entry in list(context.performance_history)[-20:-10]]
        
        if len(older_scores) < 10:
            return False
        
        # Check for performance plateau or decline
        recent_avg = np.mean(recent_scores)
        older_avg = np.mean(older_scores)
        
        # Plateau detection
        if abs(recent_avg - older_avg) < 0.01:
            context.plateau_detection = True
            return True
        
        # Performance decline
        if recent_avg < older_avg * 0.95:
            return True
        
        # Exploration factor
        time_since_improvement = datetime.now() - context.last_improvement
        if time_since_improvement.days > 7 and np.random.random() < context.exploration_factor:
            return True
        
        return False
    
    def _select_new_strategy(self, context: PerformanceContext) -> LearningStrategy:
        """Select new strategy using epsilon-greedy with UCB"""
        # Get performance history for each strategy
        strategy_performance = defaultdict(list)
        for entry in context.performance_history:
            strategy_performance[entry['strategy']].append(entry['score'])
        
        # Calculate UCB scores
        total_trials = len(context.performance_history)
        ucb_scores = {}
        
        for strategy in LearningStrategy:
            if strategy in strategy_performance:
                scores = strategy_performance[strategy]
                mean_score = np.mean(scores)
                confidence_bound = np.sqrt(2 * np.log(total_trials) / len(scores))
                ucb_scores[strategy] = mean_score + confidence_bound
            else:
                ucb_scores[strategy] = float('inf')  # Unexplored strategies get highest priority
        
        # Select strategy with highest UCB score
        return max(ucb_scores, key=ucb_scores.get)
    
    def _get_recent_performance(self, context: PerformanceContext) -> float:
        """Get recent average performance"""
        if not context.performance_history:
            return 0.0
        
        recent_entries = list(context.performance_history)[-10:]
        return np.mean([entry['score'] for entry in recent_entries])
    
    def _generate_strategy_mutations(self, current_strategy: LearningStrategy) -> List[Dict[str, Any]]:
        """Generate strategy mutations for evolutionary improvement"""
        mutations = []
        
        # Add neighboring strategies
        all_strategies = list(LearningStrategy)
        current_idx = all_strategies.index(current_strategy)
        
        for i in range(max(0, current_idx - 2), min(len(all_strategies), current_idx + 3)):
            if i != current_idx:
                mutations.append({
                    'strategy': all_strategies[i],
                    'mutation_type': 'neighbor',
                    'distance': abs(i - current_idx)
                })
        
        # Add random explorations
        for _ in range(2):
            random_strategy = np.random.choice(all_strategies)
            if random_strategy != current_strategy:
                mutations.append({
                    'strategy': random_strategy,
                    'mutation_type': 'random_exploration',
                    'distance': abs(all_strategies.index(random_strategy) - current_idx)
                })
        
        return mutations


class KnowledgeGraphIntegration:
    """Knowledge graph integration for semantic understanding"""
    
    def __init__(self, redis_client: redis.Redis):
        self.redis_client = redis_client
        self.graph = nx.DiGraph()
        self.entity_embeddings: Dict[str, np.ndarray] = {}
        self.relation_types = {
            'SIMILAR_TO', 'IMPROVES_ON', 'APPLIES_TO', 'DEPENDS_ON',
            'GENERALIZES', 'SPECIALIZES', 'CONFLICTS_WITH', 'COMPLEMENTS'
        }
        
    def add_knowledge(self, entity: str, entity_type: str, properties: Dict[str, Any]) -> None:
        """Add knowledge entity to the graph"""
        self.graph.add_node(entity, type=entity_type, **properties)
        
        # Generate simple embedding (in practice, use more sophisticated methods)
        embedding = self._generate_entity_embedding(entity, entity_type, properties)
        self.entity_embeddings[entity] = embedding
        
        # Automatically discover relationships
        self._discover_relationships(entity)
    
    def add_relationship(self, source: str, target: str, relation_type: str, 
                        strength: float = 1.0, metadata: Optional[Dict] = None) -> None:
        """Add relationship between entities"""
        if relation_type in self.relation_types:
            self.graph.add_edge(source, target, relation=relation_type, 
                              strength=strength, **(metadata or {}))
    
    def get_related_knowledge(self, entity: str, max_depth: int = 2) -> List[Dict[str, Any]]:
        """Get related knowledge within specified depth"""
        if entity not in self.graph:
            return []
        
        related = []
        visited = set()
        queue = [(entity, 0)]
        
        while queue:
            current, depth = queue.pop(0)
            if current in visited or depth > max_depth:
                continue
            
            visited.add(current)
            
            # Add neighbors
            for neighbor in self.graph.neighbors(current):
                edge_data = self.graph.get_edge_data(current, neighbor)
                related.append({
                    'entity': neighbor,
                    'relation': edge_data.get('relation'),
                    'strength': edge_data.get('strength', 1.0),
                    'depth': depth + 1,
                    'properties': dict(self.graph.nodes[neighbor])
                })
                
                if depth + 1 <= max_depth:
                    queue.append((neighbor, depth + 1))
        
        # Sort by relevance (strength * inverse depth)
        related.sort(key=lambda x: x['strength'] / (x['depth'] + 1), reverse=True)
        return related
    
    def semantic_search(self, query_entity: str, top_k: int = 10) -> List[Dict[str, Any]]:
        """Perform semantic search in the knowledge graph"""
        if query_entity not in self.entity_embeddings:
            return []
        
        query_embedding = self.entity_embeddings[query_entity]
        similarities = []
        
        for entity, embedding in self.entity_embeddings.items():
            if entity != query_entity:
                similarity = cosine_similarity([query_embedding], [embedding])[0][0]
                similarities.append({
                    'entity': entity,
                    'similarity': similarity,
                    'properties': dict(self.graph.nodes[entity])
                })
        
        similarities.sort(key=lambda x: x['similarity'], reverse=True)
        return similarities[:top_k]
    
    def get_context_recommendations(self, context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Get context-aware recommendations"""
        # Extract entities from context
        context_entities = []
        for key, value in context.items():
            if isinstance(value, str) and value in self.graph:
                context_entities.append(value)
        
        if not context_entities:
            return []
        
        # Find entities related to context
        recommendations = set()
        for entity in context_entities:
            related = self.get_related_knowledge(entity, max_depth=2)
            for item in related:
                recommendations.add(item['entity'])
        
        # Score recommendations based on connectivity
        scored_recommendations = []
        for entity in recommendations:
            if entity not in context_entities:
                score = self._calculate_context_score(entity, context_entities)
                scored_recommendations.append({
                    'entity': entity,
                    'score': score,
                    'properties': dict(self.graph.nodes[entity])
                })
        
        scored_recommendations.sort(key=lambda x: x['score'], reverse=True)
        return scored_recommendations[:10]
    
    def _generate_entity_embedding(self, entity: str, entity_type: str, 
                                 properties: Dict[str, Any]) -> np.ndarray:
        """Generate embedding for entity (simplified version)"""
        # In practice, use more sophisticated embedding methods
        features = []
        
        # Entity type embedding
        type_hash = hash(entity_type) % 100
        features.append(type_hash)
        
        # Property embeddings
        for key, value in properties.items():
            if isinstance(value, (int, float)):
                features.append(value)
            else:
                features.append(hash(str(value)) % 100)
        
        # Pad or truncate to fixed size
        target_size = 50
        if len(features) < target_size:
            features.extend([0] * (target_size - len(features)))
        else:
            features = features[:target_size]
        
        return np.array(features, dtype=np.float32)
    
    def _discover_relationships(self, entity: str) -> None:
        """Automatically discover relationships with existing entities"""
        if entity not in self.entity_embeddings:
            return
        
        entity_embedding = self.entity_embeddings[entity]
        entity_type = self.graph.nodes[entity].get('type')
        
        # Find similar entities
        for other_entity, other_embedding in self.entity_embeddings.items():
            if other_entity != entity:
                similarity = cosine_similarity([entity_embedding], [other_embedding])[0][0]
                
                if similarity > 0.8:
                    self.add_relationship(entity, other_entity, 'SIMILAR_TO', similarity)
                elif similarity > 0.6:
                    other_type = self.graph.nodes[other_entity].get('type')
                    if entity_type == other_type:
                        self.add_relationship(entity, other_entity, 'APPLIES_TO', similarity)
    
    def _calculate_context_score(self, entity: str, context_entities: List[str]) -> float:
        """Calculate relevance score for entity given context"""
        if entity not in self.graph:
            return 0.0
        
        total_score = 0.0
        for context_entity in context_entities:
            if context_entity in self.graph:
                # Check direct connection
                if self.graph.has_edge(context_entity, entity):
                    edge_data = self.graph.get_edge_data(context_entity, entity)
                    total_score += edge_data.get('strength', 1.0)
                
                # Check reverse connection
                if self.graph.has_edge(entity, context_entity):
                    edge_data = self.graph.get_edge_data(entity, context_entity)
                    total_score += edge_data.get('strength', 1.0)
                
                # Check semantic similarity
                if (entity in self.entity_embeddings and 
                    context_entity in self.entity_embeddings):
                    similarity = cosine_similarity(
                        [self.entity_embeddings[entity]],
                        [self.entity_embeddings[context_entity]]
                    )[0][0]
                    total_score += similarity * 0.5
        
        return total_score / len(context_entities) if context_entities else 0.0


class AdaptiveIntelligenceSystem:
    """Master adaptive intelligence system coordinating all AI services"""
    
    def __init__(self, redis_url: str = "redis://localhost:6379/0"):
        self.redis_client = redis.from_url(redis_url, decode_responses=True)
        
        # Initialize subsystems
        self.meta_learning = MetaLearningFramework(self.redis_client)
        self.collective_intelligence = CollectiveIntelligence(self.redis_client)
        self.self_improving = SelfImprovingAlgorithms(self.redis_client)
        self.knowledge_graph = KnowledgeGraphIntegration(self.redis_client)
        
        # Global intelligence coordination
        self.service_registry: Dict[str, Dict[str, Any]] = {}
        self.global_performance_metrics: Dict[str, deque] = defaultdict(lambda: deque(maxlen=1000))
        self.emergent_patterns: List[Dict[str, Any]] = []
        self.optimization_history: List[Dict[str, Any]] = []
        
        logger.info("Adaptive Intelligence System initialized")
    
    async def register_ai_service(self, service_id: str, service_type: str,
                                capabilities: List[str], initial_config: Dict[str, Any]) -> None:
        """Register an AI service with the intelligence system"""
        self.service_registry[service_id] = {
            'type': service_type,
            'capabilities': capabilities,
            'config': initial_config,
            'registered_at': datetime.now(),
            'performance_history': deque(maxlen=100),
            'adaptation_count': 0,
            'last_optimization': datetime.now()
        }
        
        # Register with self-improving algorithms
        initial_strategy = LearningStrategy.SUPERVISED  # Default
        if 'unsupervised' in capabilities:
            initial_strategy = LearningStrategy.UNSUPERVISED
        elif 'reinforcement' in capabilities:
            initial_strategy = LearningStrategy.REINFORCEMENT
        
        self.self_improving.register_service(service_id, initial_strategy)
        
        # Add to knowledge graph
        self.knowledge_graph.add_knowledge(
            entity=service_id,
            entity_type='ai_service',
            properties={
                'service_type': service_type,
                'capabilities': capabilities,
                'performance_tier': 'initial'
            }
        )
        
        logger.info(f"Registered AI service: {service_id} with capabilities: {capabilities}")
    
    async def process_learning_task(self, service_id: str, problem_type: ProblemType,
                                  domain: str, data_characteristics: Dict[str, Any],
                                  user_id: Optional[str] = None,
                                  organization_id: Optional[str] = None) -> Dict[str, Any]:
        """Process a learning task and return optimized strategy"""
        
        # Get strategy recommendation from meta-learning
        best_strategy, confidence = self.meta_learning.predict_best_strategy(
            problem_type, domain, data_characteristics
        )
        
        # Get collective intelligence recommendations
        collective_recommendations = self.collective_intelligence.get_recommendations(
            problem_type, domain, data_characteristics
        )
        
        # Get few-shot examples if applicable
        few_shot_examples = []
        if confidence < 0.7:  # Low confidence, use few-shot learning
            few_shot_examples = self.meta_learning.get_few_shot_examples(
                problem_type, domain, k=3
            )
        
        # Get knowledge graph context
        context = {
            'domain': domain,
            'problem_type': problem_type.value,
            'service_id': service_id
        }
        context_recommendations = self.knowledge_graph.get_context_recommendations(context)
        
        # Compile intelligence package
        intelligence_package = {
            'recommended_strategy': best_strategy.value,
            'confidence': confidence,
            'collective_insights': collective_recommendations[:5],
            'few_shot_examples': [asdict(ex) for ex in few_shot_examples],
            'knowledge_context': context_recommendations[:5],
            'optimization_hints': self._generate_optimization_hints(service_id, problem_type),
            'expected_performance': self._estimate_performance(
                best_strategy, problem_type, domain, data_characteristics
            )
        }
        
        return intelligence_package
    
    async def report_task_completion(self, service_id: str, task_id: str,
                                   problem_type: ProblemType, domain: str,
                                   data_characteristics: Dict[str, Any],
                                   strategy_used: LearningStrategy,
                                   performance_metrics: Dict[str, float],
                                   execution_time: float, success: bool = True,
                                   user_id: Optional[str] = None,
                                   organization_id: Optional[str] = None) -> None:
        """Report completion of a learning task"""
        
        # Create learning task record
        task = LearningTask(
            task_id=task_id,
            problem_type=problem_type,
            domain=domain,
            data_characteristics=data_characteristics,
            performance_metrics=performance_metrics,
            strategy_used=strategy_used,
            execution_time=execution_time,
            timestamp=datetime.now(),
            user_id=user_id,
            organization_id=organization_id,
            success=success
        )
        
        # Update all intelligence subsystems
        self.meta_learning.add_task(task)
        self.collective_intelligence.contribute_experience(task)
        
        # Update self-improving algorithms
        if performance_metrics:
            main_metric = max(performance_metrics.values())
            adapted = self.self_improving.update_performance(service_id, main_metric, execution_time)
            if adapted:
                self.service_registry[service_id]['adaptation_count'] += 1
        
        # Update service performance history
        if service_id in self.service_registry:
            self.service_registry[service_id]['performance_history'].append({
                'task_id': task_id,
                'performance': performance_metrics,
                'execution_time': execution_time,
                'success': success,
                'timestamp': datetime.now()
            })
        
        # Update global metrics
        self.global_performance_metrics['overall'].append({
            'service_id': service_id,
            'performance': max(performance_metrics.values()) if performance_metrics else 0,
            'timestamp': datetime.now()
        })
        
        # Trigger global optimization if needed
        await self._check_global_optimization()
        
        logger.info(f"Task completion reported: {task_id} with success: {success}")
    
    async def get_platform_intelligence_summary(self) -> Dict[str, Any]:
        """Get comprehensive platform intelligence summary"""
        
        # Calculate global performance trends
        performance_trend = self._calculate_performance_trend()
        
        # Get top performing services
        top_services = self._get_top_performing_services(limit=5)
        
        # Get best practices across domains
        all_domains = set()
        for service_info in self.service_registry.values():
            if 'domain' in service_info.get('config', {}):
                all_domains.add(service_info['config']['domain'])
        
        best_practices_by_domain = {}
        for domain in all_domains:
            best_practices_by_domain[domain] = self.collective_intelligence.identify_best_practices(domain)
        
        # Get emergent patterns
        emergent_patterns = self._detect_emergent_patterns()
        
        # Compile summary
        summary = {
            'timestamp': datetime.now().isoformat(),
            'registered_services': len(self.service_registry),
            'total_tasks_processed': len(self.meta_learning.task_history),
            'performance_trend': performance_trend,
            'top_performing_services': top_services,
            'best_practices_by_domain': best_practices_by_domain,
            'emergent_patterns': emergent_patterns,
            'global_optimization_opportunities': self._identify_optimization_opportunities(),
            'knowledge_graph_entities': len(self.knowledge_graph.graph.nodes),
            'knowledge_graph_relationships': len(self.knowledge_graph.graph.edges)
        }
        
        return summary
    
    async def optimize_service_configuration(self, service_id: str) -> Dict[str, Any]:
        """Optimize configuration for a specific service"""
        if service_id not in self.service_registry:
            return {'error': 'Service not found'}
        
        service_info = self.service_registry[service_id]
        
        # Get evolutionary improvements
        evolutionary_plan = self.self_improving.evolutionary_improvement(service_id)
        
        # Get performance analysis
        performance_analysis = self._analyze_service_performance(service_id)
        
        # Get knowledge graph recommendations
        related_knowledge = self.knowledge_graph.get_related_knowledge(service_id)
        
        # Generate optimization recommendations
        recommendations = {
            'service_id': service_id,
            'current_performance': performance_analysis,
            'evolutionary_improvements': evolutionary_plan,
            'related_knowledge': related_knowledge[:10],
            'optimization_actions': self._generate_optimization_actions(service_id),
            'expected_improvement': self._estimate_improvement_potential(service_id)
        }
        
        # Record optimization attempt
        self.optimization_history.append({
            'service_id': service_id,
            'timestamp': datetime.now(),
            'recommendations': recommendations
        })
        
        return recommendations
    
    def _generate_optimization_hints(self, service_id: str, problem_type: ProblemType) -> List[str]:
        """Generate optimization hints for a service"""
        hints = []
        
        if service_id in self.service_registry:
            service_info = self.service_registry[service_id]
            
            # Performance-based hints
            if len(service_info['performance_history']) > 5:
                recent_performance = [
                    max(entry['performance'].values()) if entry['performance'] else 0
                    for entry in list(service_info['performance_history'])[-5:]
                ]
                avg_performance = np.mean(recent_performance)
                
                if avg_performance < 0.7:
                    hints.append("Consider data preprocessing improvements")
                    hints.append("Experiment with different algorithms")
                
                if np.std(recent_performance) > 0.1:
                    hints.append("Performance variance is high - consider ensemble methods")
            
            # Problem type specific hints
            if problem_type == ProblemType.CLASSIFICATION:
                hints.append("Consider class balancing techniques")
                hints.append("Evaluate feature selection methods")
            elif problem_type == ProblemType.NLP:
                hints.append("Consider pre-trained embeddings")
                hints.append("Experiment with attention mechanisms")
        
        return hints
    
    def _estimate_performance(self, strategy: LearningStrategy, problem_type: ProblemType,
                            domain: str, data_characteristics: Dict[str, Any]) -> Dict[str, float]:
        """Estimate expected performance for a strategy"""
        # Simple heuristic-based estimation
        base_performance = 0.7
        
        # Strategy adjustments
        if strategy == LearningStrategy.META_LEARNING:
            base_performance += 0.1
        elif strategy == LearningStrategy.TRANSFER_LEARNING:
            base_performance += 0.05
        
        # Data size adjustments
        sample_size = data_characteristics.get('sample_size', 1000)
        if sample_size > 10000:
            base_performance += 0.05
        elif sample_size < 100:
            base_performance -= 0.1
        
        return {
            'expected_accuracy': min(1.0, base_performance),
            'confidence_interval': (base_performance - 0.05, min(1.0, base_performance + 0.05))
        }
    
    def _calculate_performance_trend(self) -> Dict[str, Any]:
        """Calculate global performance trend"""
        if not self.global_performance_metrics['overall']:
            return {'trend': 'insufficient_data'}
        
        recent_data = list(self.global_performance_metrics['overall'])[-50:]
        if len(recent_data) < 10:
            return {'trend': 'insufficient_data'}
        
        performances = [entry['performance'] for entry in recent_data]
        timestamps = [entry['timestamp'] for entry in recent_data]
        
        # Simple linear trend calculation
        time_diffs = [(ts - timestamps[0]).total_seconds() for ts in timestamps]
        correlation = np.corrcoef(time_diffs, performances)[0, 1] if len(set(performances)) > 1 else 0
        
        trend_direction = 'improving' if correlation > 0.1 else 'declining' if correlation < -0.1 else 'stable'
        
        return {
            'trend': trend_direction,
            'correlation': correlation,
            'average_performance': np.mean(performances),
            'performance_std': np.std(performances),
            'sample_size': len(recent_data)
        }
    
    def _get_top_performing_services(self, limit: int = 5) -> List[Dict[str, Any]]:
        """Get top performing services"""
        service_performances = []
        
        for service_id, service_info in self.service_registry.items():
            if service_info['performance_history']:
                recent_performances = [
                    max(entry['performance'].values()) if entry['performance'] else 0
                    for entry in list(service_info['performance_history'])[-10:]
                ]
                avg_performance = np.mean(recent_performances)
                
                service_performances.append({
                    'service_id': service_id,
                    'service_type': service_info['type'],
                    'average_performance': avg_performance,
                    'task_count': len(service_info['performance_history']),
                    'adaptation_count': service_info['adaptation_count']
                })
        
        service_performances.sort(key=lambda x: x['average_performance'], reverse=True)
        return service_performances[:limit]
    
    def _detect_emergent_patterns(self) -> List[Dict[str, Any]]:
        """Detect emergent patterns in the platform"""
        patterns = []
        
        # Pattern: Services that improve together
        if len(self.service_registry) >= 2:
            service_correlations = self._calculate_service_correlations()
            for (service1, service2), correlation in service_correlations.items():
                if correlation > 0.7:
                    patterns.append({
                        'type': 'correlated_improvement',
                        'services': [service1, service2],
                        'correlation': correlation,
                        'description': f"Services {service1} and {service2} show correlated performance improvements"
                    })
        
        # Pattern: Domain expertise transfer
        domain_transfers = self._detect_domain_transfers()
        patterns.extend(domain_transfers)
        
        return patterns
    
    def _calculate_service_correlations(self) -> Dict[Tuple[str, str], float]:
        """Calculate performance correlations between services"""
        correlations = {}
        service_ids = list(self.service_registry.keys())
        
        for i, service1 in enumerate(service_ids):
            for service2 in service_ids[i+1:]:
                correlation = self._calculate_pairwise_correlation(service1, service2)
                if correlation is not None:
                    correlations[(service1, service2)] = correlation
        
        return correlations
    
    def _calculate_pairwise_correlation(self, service1: str, service2: str) -> Optional[float]:
        """Calculate correlation between two services"""
        hist1 = self.service_registry[service1]['performance_history']
        hist2 = self.service_registry[service2]['performance_history']
        
        if len(hist1) < 5 or len(hist2) < 5:
            return None
        
        # Align timestamps and calculate correlation
        perf1 = [max(entry['performance'].values()) if entry['performance'] else 0 
                for entry in list(hist1)[-10:]]
        perf2 = [max(entry['performance'].values()) if entry['performance'] else 0 
                for entry in list(hist2)[-10:]]
        
        min_length = min(len(perf1), len(perf2))
        if min_length < 3:
            return None
        
        perf1 = perf1[-min_length:]
        perf2 = perf2[-min_length:]
        
        return np.corrcoef(perf1, perf2)[0, 1] if len(set(perf1)) > 1 and len(set(perf2)) > 1 else 0
    
    def _detect_domain_transfers(self) -> List[Dict[str, Any]]:
        """Detect successful domain knowledge transfers"""
        transfers = []
        
        # Look for patterns in the meta-learning history
        domain_performance = defaultdict(list)
        for task in self.meta_learning.task_history:
            if task.success:
                domain_performance[task.domain].append(max(task.performance_metrics.values()))
        
        # Find domains with improving performance
        for domain, performances in domain_performance.items():
            if len(performances) >= 5:
                recent_perf = np.mean(performances[-3:])
                early_perf = np.mean(performances[:3])
                
                if recent_perf > early_perf + 0.1:  # Significant improvement
                    transfers.append({
                        'type': 'domain_improvement',
                        'domain': domain,
                        'improvement': recent_perf - early_perf,
                        'description': f"Domain {domain} shows significant performance improvement over time"
                    })
        
        return transfers
    
    def _identify_optimization_opportunities(self) -> List[Dict[str, Any]]:
        """Identify global optimization opportunities"""
        opportunities = []
        
        # Underperforming services
        for service_id, service_info in self.service_registry.items():
            if service_info['performance_history']:
                recent_performance = [
                    max(entry['performance'].values()) if entry['performance'] else 0
                    for entry in list(service_info['performance_history'])[-5:]
                ]
                avg_performance = np.mean(recent_performance)
                
                if avg_performance < 0.6:
                    opportunities.append({
                        'type': 'underperforming_service',
                        'service_id': service_id,
                        'current_performance': avg_performance,
                        'recommendation': 'Consider strategy adaptation or retraining'
                    })
        
        # Resource optimization
        high_execution_times = []
        for service_id, service_info in self.service_registry.items():
            if service_info['performance_history']:
                recent_times = [
                    entry['execution_time'] for entry in list(service_info['performance_history'])[-5:]
                    if 'execution_time' in entry
                ]
                if recent_times and np.mean(recent_times) > 60:  # More than 1 minute
                    high_execution_times.append({
                        'service_id': service_id,
                        'avg_execution_time': np.mean(recent_times)
                    })
        
        if high_execution_times:
            opportunities.append({
                'type': 'execution_time_optimization',
                'services': high_execution_times,
                'recommendation': 'Consider algorithm optimization or resource scaling'
            })
        
        return opportunities
    
    def _analyze_service_performance(self, service_id: str) -> Dict[str, Any]:
        """Analyze performance for a specific service"""
        service_info = self.service_registry[service_id]
        
        if not service_info['performance_history']:
            return {'status': 'insufficient_data'}
        
        recent_entries = list(service_info['performance_history'])[-10:]
        
        performances = [max(entry['performance'].values()) if entry['performance'] else 0 
                       for entry in recent_entries]
        execution_times = [entry.get('execution_time', 0) for entry in recent_entries]
        
        analysis = {
            'average_performance': np.mean(performances),
            'performance_std': np.std(performances),
            'average_execution_time': np.mean(execution_times),
            'success_rate': np.mean([entry.get('success', True) for entry in recent_entries]),
            'performance_trend': 'improving' if len(performances) > 3 and 
                               np.mean(performances[-3:]) > np.mean(performances[:-3]) else 'stable',
            'total_tasks': len(service_info['performance_history']),
            'adaptation_count': service_info['adaptation_count']
        }
        
        return analysis
    
    def _generate_optimization_actions(self, service_id: str) -> List[Dict[str, Any]]:
        """Generate specific optimization actions for a service"""
        actions = []
        
        analysis = self._analyze_service_performance(service_id)
        
        if analysis.get('average_performance', 0) < 0.7:
            actions.append({
                'action': 'strategy_adaptation',
                'priority': 'high',
                'description': 'Adapt learning strategy based on recent performance',
                'expected_impact': 'medium'
            })
        
        if analysis.get('average_execution_time', 0) > 30:
            actions.append({
                'action': 'algorithm_optimization',
                'priority': 'medium',
                'description': 'Optimize algorithm for faster execution',
                'expected_impact': 'high'
            })
        
        if analysis.get('success_rate', 1.0) < 0.9:
            actions.append({
                'action': 'error_handling_improvement',
                'priority': 'high',
                'description': 'Improve error handling and recovery mechanisms',
                'expected_impact': 'medium'
            })
        
        return actions
    
    def _estimate_improvement_potential(self, service_id: str) -> Dict[str, Any]:
        """Estimate improvement potential for a service"""
        analysis = self._analyze_service_performance(service_id)
        
        current_performance = analysis.get('average_performance', 0.5)
        performance_std = analysis.get('performance_std', 0.1)
        
        # Simple heuristic for improvement potential
        improvement_potential = min(0.3, (1.0 - current_performance) * 0.5)
        confidence = max(0.1, 1.0 - performance_std)  # Lower std = higher confidence
        
        return {
            'estimated_improvement': improvement_potential,
            'confidence': confidence,
            'time_to_improvement': '1-2 weeks',
            'risk_level': 'low' if confidence > 0.7 else 'medium'
        }
    
    async def _check_global_optimization(self) -> None:
        """Check if global optimization is needed"""
        # Simple trigger: every 100 tasks or every day
        total_tasks = len(self.meta_learning.task_history)
        
        if total_tasks > 0 and (total_tasks % 100 == 0):
            await self._perform_global_optimization()
    
    async def _perform_global_optimization(self) -> None:
        """Perform global platform optimization"""
        logger.info("Performing global platform optimization")
        
        # Update knowledge graph relationships
        for service_id in self.service_registry.keys():
            self.knowledge_graph._discover_relationships(service_id)
        
        # Update collective intelligence patterns
        # This happens automatically through task reporting
        
        # Trigger evolutionary improvements for all services
        for service_id in self.service_registry.keys():
            evolutionary_plan = self.self_improving.evolutionary_improvement(service_id)
            if evolutionary_plan.get('recommended_experiments', 0) > 0:
                logger.info(f"Service {service_id} has {evolutionary_plan['recommended_experiments']} "
                          f"recommended experiments")
        
        logger.info("Global optimization completed")


# Utility functions for external integration

def create_adaptive_intelligence_system(redis_url: str = "redis://localhost:6379/0") -> AdaptiveIntelligenceSystem:
    """Create and initialize the adaptive intelligence system"""
    return AdaptiveIntelligenceSystem(redis_url)


async def get_intelligence_recommendation(system: AdaptiveIntelligenceSystem,
                                        service_id: str, problem_type: str, 
                                        domain: str, data_characteristics: Dict[str, Any],
                                        user_id: Optional[str] = None,
                                        organization_id: Optional[str] = None) -> Dict[str, Any]:
    """Get intelligence recommendation for a learning task"""
    problem_enum = ProblemType(problem_type.lower())
    return await system.process_learning_task(
        service_id, problem_enum, domain, data_characteristics, user_id, organization_id
    )


async def report_learning_outcome(system: AdaptiveIntelligenceSystem,
                                service_id: str, task_id: str, problem_type: str,
                                domain: str, data_characteristics: Dict[str, Any],
                                strategy_used: str, performance_metrics: Dict[str, float],
                                execution_time: float, success: bool = True,
                                user_id: Optional[str] = None,
                                organization_id: Optional[str] = None) -> None:
    """Report the outcome of a learning task"""
    problem_enum = ProblemType(problem_type.lower())
    strategy_enum = LearningStrategy(strategy_used.lower())
    
    await system.report_task_completion(
        service_id, task_id, problem_enum, domain, data_characteristics,
        strategy_enum, performance_metrics, execution_time, success,
        user_id, organization_id
    )