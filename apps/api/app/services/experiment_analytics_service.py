"""
Experiment Analytics Service
============================

Advanced analytics and insights service for experiment tracking that provides:
- Statistical experiment comparison and analysis
- Performance trend analysis over time
- Resource efficiency analysis and optimization
- Best practice recommendations based on experiment patterns
- Automated experiment reporting and insights generation
- Multi-objective optimization analysis
- Experiment portfolio management analytics
"""

import os
import json
import statistics
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple, Union
from dataclasses import dataclass, asdict
from collections import defaultdict
import numpy as np
import pandas as pd

# Statistical analysis
from scipy import stats
from sklearn.metrics import silhouette_score
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA

# Import enhanced experiment tracker
try:
    from app.ml.enhanced_experiment_tracker import (
        EnhancedExperimentTracker, ExperimentInsights, ResourceUsage,
        MetricType, OptimizationObjective, ExperimentType
    )
except ImportError as e:
    logging.warning(f"Could not import enhanced experiment tracker: {e}")
    EnhancedExperimentTracker = None

logger = logging.getLogger(__name__)


@dataclass
class TrendAnalysis:
    """Trend analysis results."""
    metric_name: str
    time_period_days: int
    trend_direction: str  # 'improving', 'declining', 'stable'
    trend_strength: float  # 0-1, strength of trend
    seasonal_pattern: bool
    volatility: float
    predictions: List[Dict[str, Any]]  # Future predictions
    confidence_interval: Tuple[float, float]


@dataclass
class PerformanceComparison:
    """Performance comparison results."""
    comparison_type: str
    experiments_compared: List[str]
    winner: str
    performance_improvement: float
    statistical_significance: float
    confidence_level: float
    effect_size: float
    comparison_metrics: Dict[str, Any]


@dataclass
class ResourceEfficiencyAnalysis:
    """Resource efficiency analysis results."""
    efficiency_score: float  # 0-1 overall efficiency
    cpu_efficiency: float
    memory_efficiency: float
    gpu_efficiency: float
    time_efficiency: float
    cost_efficiency: Optional[float]
    carbon_efficiency: Optional[float]
    recommendations: List[str]
    benchmark_comparison: Dict[str, float]


@dataclass
class BestPracticeRecommendation:
    """Best practice recommendation."""
    category: str  # 'hyperparameters', 'architecture', 'training', 'data'
    recommendation: str
    confidence: float  # 0-1
    supporting_experiments: List[str]
    expected_improvement: float
    implementation_difficulty: str  # 'easy', 'medium', 'hard'


@dataclass
class ExperimentPortfolioAnalysis:
    """Analysis of experiment portfolio."""
    total_experiments: int
    success_rate: float
    avg_performance: float
    performance_distribution: Dict[str, int]
    resource_utilization: Dict[str, float]
    experiment_diversity: float
    exploration_exploitation_balance: float
    portfolio_health_score: float
    recommendations: List[BestPracticeRecommendation]


class ExperimentAnalyticsService:
    """
    Advanced experiment analytics service providing comprehensive insights
    and recommendations for experiment optimization.
    """
    
    def __init__(self, 
                 experiment_tracker: Optional[EnhancedExperimentTracker] = None,
                 storage_path: str = "./experiment_analytics"):
        
        self.experiment_tracker = experiment_tracker
        self.storage_path = storage_path
        self.analytics_path = os.path.join(storage_path, "analytics")
        self.reports_path = os.path.join(storage_path, "reports")
        self.benchmarks_path = os.path.join(storage_path, "benchmarks")
        
        # Create directories
        for path in [self.analytics_path, self.reports_path, self.benchmarks_path]:
            os.makedirs(path, exist_ok=True)
        
        # Analytics cache
        self._trend_cache: Dict[str, TrendAnalysis] = {}
        self._comparison_cache: Dict[str, PerformanceComparison] = {}
        self._efficiency_cache: Dict[str, ResourceEfficiencyAnalysis] = {}
        
        # Benchmarks and baselines
        self._performance_benchmarks: Dict[str, Dict[str, float]] = {}
        self._resource_benchmarks: Dict[str, Dict[str, float]] = {}
        
        # Load existing data
        self._load_benchmarks()
        
        logger.info(f"Experiment Analytics Service initialized at {storage_path}")
    
    def analyze_experiment_trends(self, 
                                 experiment_ids: List[str],
                                 metric_names: List[str],
                                 time_period_days: int = 30,
                                 include_predictions: bool = True) -> List[TrendAnalysis]:
        """Analyze performance trends across experiments over time."""
        
        trend_analyses = []
        
        for metric_name in metric_names:
            cache_key = f"{metric_name}_{time_period_days}_{hash(tuple(experiment_ids))}"
            
            # Check cache first
            if cache_key in self._trend_cache:
                trend_analyses.append(self._trend_cache[cache_key])
                continue
            
            # Collect metric data across experiments
            metric_timeline = []
            
            for exp_id in experiment_ids:
                if not self.experiment_tracker:
                    continue
                
                try:
                    metrics = self.experiment_tracker.get_experiment_metrics(exp_id)
                    if metric_name in metrics:
                        metric_data = metrics[metric_name]
                        if isinstance(metric_data, list):
                            for entry in metric_data:
                                metric_timeline.append({
                                    'timestamp': datetime.fromisoformat(entry['timestamp']),
                                    'value': entry['value'],
                                    'experiment_id': exp_id,
                                    'step': entry.get('step', 0)
                                })
                except Exception as e:
                    logger.warning(f"Could not get metrics for experiment {exp_id}: {e}")
                    continue
            
            if not metric_timeline:
                continue
            
            # Sort by timestamp
            metric_timeline.sort(key=lambda x: x['timestamp'])
            
            # Filter by time period
            cutoff_date = datetime.utcnow() - timedelta(days=time_period_days)
            recent_metrics = [m for m in metric_timeline if m['timestamp'] >= cutoff_date]
            
            if len(recent_metrics) < 3:
                continue
            
            # Analyze trend
            values = [m['value'] for m in recent_metrics]
            timestamps = [(m['timestamp'] - recent_metrics[0]['timestamp']).total_seconds() 
                         for m in recent_metrics]
            
            # Linear regression for trend
            if len(values) > 1:
                slope, intercept, r_value, p_value, std_err = stats.linregress(timestamps, values)
                
                # Determine trend direction
                if abs(slope) < std_err:
                    trend_direction = 'stable'
                elif slope > 0:
                    trend_direction = 'improving'
                else:
                    trend_direction = 'declining'
                
                trend_strength = min(abs(r_value), 1.0)
                
                # Check for seasonal patterns (simplified)
                seasonal_pattern = self._detect_seasonal_pattern(values, timestamps)
                
                # Calculate volatility
                volatility = statistics.stdev(values) / statistics.mean(values) if statistics.mean(values) != 0 else 0
                
                # Generate predictions
                predictions = []
                confidence_interval = (0, 0)
                
                if include_predictions and len(values) >= 5:
                    predictions, confidence_interval = self._generate_trend_predictions(
                        values, timestamps, slope, intercept, std_err
                    )
                
                trend_analysis = TrendAnalysis(
                    metric_name=metric_name,
                    time_period_days=time_period_days,
                    trend_direction=trend_direction,
                    trend_strength=trend_strength,
                    seasonal_pattern=seasonal_pattern,
                    volatility=volatility,
                    predictions=predictions,
                    confidence_interval=confidence_interval
                )
                
                # Cache result
                self._trend_cache[cache_key] = trend_analysis
                trend_analyses.append(trend_analysis)
        
        return trend_analyses
    
    def compare_experiment_performance(self,
                                     experiment_ids: List[str],
                                     comparison_metrics: List[str] = None,
                                     statistical_test: str = 'ttest',
                                     confidence_level: float = 0.95) -> PerformanceComparison:
        """Perform statistical comparison of experiment performance."""
        
        if len(experiment_ids) < 2:
            raise ValueError("At least 2 experiments required for comparison")
        
        cache_key = f"comparison_{hash(tuple(experiment_ids))}_{hash(tuple(comparison_metrics or []))}"
        
        # Check cache
        if cache_key in self._comparison_cache:
            return self._comparison_cache[cache_key]
        
        # Collect performance data
        experiment_performance = {}
        
        for exp_id in experiment_ids:
            if not self.experiment_tracker:
                continue
            
            try:
                metrics = self.experiment_tracker.get_experiment_metrics(exp_id)
                performance_data = {}
                
                for metric_name, metric_data in metrics.items():
                    if comparison_metrics and metric_name not in comparison_metrics:
                        continue
                    
                    if isinstance(metric_data, list) and metric_data:
                        # Use final value for comparison
                        final_value = metric_data[-1]['value']
                        performance_data[metric_name] = final_value
                
                if performance_data:
                    experiment_performance[exp_id] = performance_data
            
            except Exception as e:
                logger.warning(f"Could not get performance data for experiment {exp_id}: {e}")
        
        if len(experiment_performance) < 2:
            raise ValueError("Insufficient performance data for comparison")
        
        # Perform statistical comparison
        comparison_results = {}
        overall_scores = {}
        
        # Calculate overall performance score for each experiment
        for exp_id, performance in experiment_performance.items():
            if performance:
                overall_scores[exp_id] = statistics.mean(performance.values())
        
        # Find winner
        winner = max(overall_scores, key=overall_scores.get)
        runner_up = sorted(overall_scores.items(), key=lambda x: x[1], reverse=True)[1][0]
        
        # Calculate performance improvement
        performance_improvement = (overall_scores[winner] - overall_scores[runner_up]) / overall_scores[runner_up] * 100
        
        # Statistical significance testing
        winner_values = list(experiment_performance[winner].values())
        runner_up_values = list(experiment_performance[runner_up].values())
        
        statistical_significance = 0.0
        effect_size = 0.0
        
        if statistical_test == 'ttest' and len(winner_values) > 1 and len(runner_up_values) > 1:
            try:
                t_stat, p_value = stats.ttest_ind(winner_values, runner_up_values)
                statistical_significance = 1 - p_value
                
                # Calculate Cohen's d (effect size)
                pooled_std = np.sqrt(((len(winner_values) - 1) * np.var(winner_values, ddof=1) +
                                    (len(runner_up_values) - 1) * np.var(runner_up_values, ddof=1)) /
                                   (len(winner_values) + len(runner_up_values) - 2))
                if pooled_std > 0:
                    effect_size = (np.mean(winner_values) - np.mean(runner_up_values)) / pooled_std
            
            except Exception as e:
                logger.warning(f"Statistical test failed: {e}")
        
        # Detailed metric comparison
        for metric_name in set().union(*[perf.keys() for perf in experiment_performance.values()]):
            metric_values = {}
            for exp_id, performance in experiment_performance.items():
                if metric_name in performance:
                    metric_values[exp_id] = performance[metric_name]
            
            if len(metric_values) >= 2:
                comparison_results[metric_name] = {
                    'values': metric_values,
                    'winner': max(metric_values, key=metric_values.get),
                    'improvement_pct': ((max(metric_values.values()) - min(metric_values.values())) /
                                      min(metric_values.values()) * 100) if min(metric_values.values()) > 0 else 0
                }
        
        comparison = PerformanceComparison(
            comparison_type=statistical_test,
            experiments_compared=experiment_ids,
            winner=winner,
            performance_improvement=performance_improvement,
            statistical_significance=statistical_significance,
            confidence_level=confidence_level,
            effect_size=effect_size,
            comparison_metrics=comparison_results
        )
        
        # Cache result
        self._comparison_cache[cache_key] = comparison
        
        return comparison
    
    def analyze_resource_efficiency(self,
                                   experiment_ids: List[str],
                                   include_cost_analysis: bool = True) -> List[ResourceEfficiencyAnalysis]:
        """Analyze resource efficiency across experiments."""
        
        efficiency_analyses = []
        
        for exp_id in experiment_ids:
            cache_key = f"efficiency_{exp_id}_{include_cost_analysis}"
            
            # Check cache
            if cache_key in self._efficiency_cache:
                efficiency_analyses.append(self._efficiency_cache[cache_key])
                continue
            
            if not self.experiment_tracker:
                continue
            
            try:
                # Get experiment insights which includes resource usage
                insights = self.experiment_tracker.get_experiment_insights(exp_id)
                experiment = self.experiment_tracker._active_experiments.get(exp_id, {})
                resource_data = experiment.get('resource_usage', {})
                
                if not resource_data:
                    continue
                
                resource_usage = ResourceUsage(**resource_data)
                
                # Calculate efficiency metrics
                cpu_efficiency = self._calculate_cpu_efficiency(resource_usage)
                memory_efficiency = self._calculate_memory_efficiency(resource_usage)
                gpu_efficiency = self._calculate_gpu_efficiency(resource_usage)
                time_efficiency = self._calculate_time_efficiency(resource_usage, insights.performance_summary)
                
                # Overall efficiency score
                efficiency_score = statistics.mean([
                    cpu_efficiency, memory_efficiency, gpu_efficiency, time_efficiency
                ])
                
                # Cost and carbon efficiency (if data available)
                cost_efficiency = None
                carbon_efficiency = None
                
                if include_cost_analysis:
                    cost_efficiency = self._calculate_cost_efficiency(resource_usage)
                    carbon_efficiency = self._calculate_carbon_efficiency(resource_usage)
                
                # Generate recommendations
                recommendations = self._generate_efficiency_recommendations(
                    resource_usage, cpu_efficiency, memory_efficiency, gpu_efficiency, time_efficiency
                )
                
                # Benchmark comparison
                benchmark_comparison = self._compare_to_benchmarks(exp_id, resource_usage)
                
                analysis = ResourceEfficiencyAnalysis(
                    efficiency_score=efficiency_score,
                    cpu_efficiency=cpu_efficiency,
                    memory_efficiency=memory_efficiency,
                    gpu_efficiency=gpu_efficiency,
                    time_efficiency=time_efficiency,
                    cost_efficiency=cost_efficiency,
                    carbon_efficiency=carbon_efficiency,
                    recommendations=recommendations,
                    benchmark_comparison=benchmark_comparison
                )
                
                # Cache result
                self._efficiency_cache[cache_key] = analysis
                efficiency_analyses.append(analysis)
            
            except Exception as e:
                logger.warning(f"Could not analyze efficiency for experiment {exp_id}: {e}")
        
        return efficiency_analyses
    
    def generate_best_practice_recommendations(self,
                                             experiment_ids: List[str],
                                             min_confidence: float = 0.7) -> List[BestPracticeRecommendation]:
        """Generate best practice recommendations based on experiment patterns."""
        
        recommendations = []
        
        if not self.experiment_tracker:
            return recommendations
        
        # Analyze experiment patterns
        successful_experiments = []
        failed_experiments = []
        
        for exp_id in experiment_ids:
            try:
                insights = self.experiment_tracker.get_experiment_insights(exp_id)
                experiment = self.experiment_tracker._active_experiments.get(exp_id, {})
                
                # Determine success based on performance
                avg_performance = statistics.mean(insights.performance_summary.values()) if insights.performance_summary else 0
                
                if avg_performance >= 0.8:  # Assuming normalized 0-1 scores
                    successful_experiments.append({
                        'experiment_id': exp_id,
                        'insights': insights,
                        'config': experiment,
                        'performance': avg_performance
                    })
                elif avg_performance < 0.5:
                    failed_experiments.append({
                        'experiment_id': exp_id,
                        'insights': insights,
                        'config': experiment,
                        'performance': avg_performance
                    })
            
            except Exception as e:
                logger.warning(f"Could not analyze experiment {exp_id} for best practices: {e}")
        
        # Generate hyperparameter recommendations
        hp_recommendations = self._analyze_hyperparameter_patterns(successful_experiments, failed_experiments)
        recommendations.extend(hp_recommendations)
        
        # Generate architecture recommendations
        arch_recommendations = self._analyze_architecture_patterns(successful_experiments, failed_experiments)
        recommendations.extend(arch_recommendations)
        
        # Generate training recommendations
        training_recommendations = self._analyze_training_patterns(successful_experiments, failed_experiments)
        recommendations.extend(training_recommendations)
        
        # Generate data recommendations
        data_recommendations = self._analyze_data_patterns(successful_experiments, failed_experiments)
        recommendations.extend(data_recommendations)
        
        # Filter by confidence threshold
        high_confidence_recommendations = [rec for rec in recommendations if rec.confidence >= min_confidence]
        
        return high_confidence_recommendations
    
    def analyze_experiment_portfolio(self,
                                   experiment_ids: List[str],
                                   time_period_days: int = 90) -> ExperimentPortfolioAnalysis:
        """Analyze the overall experiment portfolio for insights and optimization."""
        
        if not self.experiment_tracker:
            raise ValueError("Experiment tracker not available")
        
        # Filter experiments by time period
        cutoff_date = datetime.utcnow() - timedelta(days=time_period_days)
        filtered_experiments = []
        
        for exp_id in experiment_ids:
            try:
                experiment = self.experiment_tracker._active_experiments.get(exp_id, {})
                created_at = datetime.fromisoformat(experiment.get('created_at', '1970-01-01'))
                
                if created_at >= cutoff_date:
                    filtered_experiments.append(exp_id)
            
            except Exception as e:
                logger.warning(f"Could not filter experiment {exp_id}: {e}")
        
        total_experiments = len(filtered_experiments)
        if total_experiments == 0:
            raise ValueError("No experiments found in specified time period")
        
        # Calculate success rate
        successful_count = 0
        performance_scores = []
        performance_distribution = {'excellent': 0, 'good': 0, 'average': 0, 'poor': 0}
        
        total_resource_usage = {
            'cpu_hours': 0,
            'memory_gb_hours': 0,
            'gpu_hours': 0,
            'training_time_hours': 0
        }
        
        experiment_configs = []
        
        for exp_id in filtered_experiments:
            try:
                insights = self.experiment_tracker.get_experiment_insights(exp_id)
                experiment = self.experiment_tracker._active_experiments.get(exp_id, {})
                
                # Calculate performance score
                avg_performance = statistics.mean(insights.performance_summary.values()) if insights.performance_summary else 0
                performance_scores.append(avg_performance)
                
                # Categorize performance
                if avg_performance >= 0.9:
                    performance_distribution['excellent'] += 1
                    successful_count += 1
                elif avg_performance >= 0.7:
                    performance_distribution['good'] += 1
                    successful_count += 1
                elif avg_performance >= 0.5:
                    performance_distribution['average'] += 1
                else:
                    performance_distribution['poor'] += 1
                
                # Aggregate resource usage
                resource_data = experiment.get('resource_usage', {})
                if resource_data:
                    resource_usage = ResourceUsage(**resource_data)
                    training_hours = resource_usage.training_time_seconds / 3600
                    
                    total_resource_usage['training_time_hours'] += training_hours
                    total_resource_usage['cpu_hours'] += (resource_usage.avg_cpu_usage / 100) * training_hours
                    total_resource_usage['memory_gb_hours'] += resource_usage.peak_memory_usage * training_hours
                    total_resource_usage['gpu_hours'] += (resource_usage.avg_gpu_usage / 100) * training_hours
                
                # Collect experiment configs for diversity analysis
                experiment_configs.append(experiment)
            
            except Exception as e:
                logger.warning(f"Could not analyze experiment {exp_id} in portfolio: {e}")
        
        success_rate = successful_count / total_experiments
        avg_performance = statistics.mean(performance_scores) if performance_scores else 0
        
        # Calculate experiment diversity
        experiment_diversity = self._calculate_experiment_diversity(experiment_configs)
        
        # Calculate exploration vs exploitation balance
        exploration_exploitation_balance = self._calculate_exploration_exploitation_balance(experiment_configs)
        
        # Calculate portfolio health score
        portfolio_health_score = self._calculate_portfolio_health_score(
            success_rate, avg_performance, experiment_diversity, exploration_exploitation_balance
        )
        
        # Generate portfolio recommendations
        portfolio_recommendations = self._generate_portfolio_recommendations(
            success_rate, avg_performance, experiment_diversity, exploration_exploitation_balance,
            performance_distribution, total_resource_usage
        )
        
        return ExperimentPortfolioAnalysis(
            total_experiments=total_experiments,
            success_rate=success_rate,
            avg_performance=avg_performance,
            performance_distribution=performance_distribution,
            resource_utilization=total_resource_usage,
            experiment_diversity=experiment_diversity,
            exploration_exploitation_balance=exploration_exploitation_balance,
            portfolio_health_score=portfolio_health_score,
            recommendations=portfolio_recommendations
        )
    
    def generate_automated_report(self,
                                 experiment_ids: List[str],
                                 report_type: str = 'comprehensive',
                                 include_visualizations: bool = True) -> Dict[str, Any]:
        """Generate automated experiment analysis report."""
        
        report = {
            'report_id': str(uuid.uuid4()),
            'generated_at': datetime.utcnow().isoformat(),
            'report_type': report_type,
            'experiments_analyzed': experiment_ids,
            'summary': {},
            'sections': {}
        }
        
        try:
            # Executive Summary
            portfolio_analysis = self.analyze_experiment_portfolio(experiment_ids)
            report['summary'] = {
                'total_experiments': portfolio_analysis.total_experiments,
                'success_rate': portfolio_analysis.success_rate,
                'avg_performance': portfolio_analysis.avg_performance,
                'portfolio_health': portfolio_analysis.portfolio_health_score,
                'key_insights': []
            }
            
            # Performance Trends Section
            if report_type in ['comprehensive', 'performance']:
                trend_analyses = self.analyze_experiment_trends(
                    experiment_ids, 
                    ['accuracy', 'loss', 'val_loss', 'f1_score', 'mse']
                )
                report['sections']['trends'] = {
                    'title': 'Performance Trends Analysis',
                    'trends': [asdict(trend) for trend in trend_analyses],
                    'insights': self._generate_trend_insights(trend_analyses)
                }
            
            # Resource Efficiency Section
            if report_type in ['comprehensive', 'efficiency']:
                efficiency_analyses = self.analyze_resource_efficiency(experiment_ids)
                report['sections']['efficiency'] = {
                    'title': 'Resource Efficiency Analysis',
                    'analyses': [asdict(analysis) for analysis in efficiency_analyses],
                    'avg_efficiency': statistics.mean([a.efficiency_score for a in efficiency_analyses]) if efficiency_analyses else 0,
                    'recommendations': []
                }
                
                # Aggregate efficiency recommendations
                for analysis in efficiency_analyses:
                    report['sections']['efficiency']['recommendations'].extend(analysis.recommendations)
            
            # Best Practices Section
            if report_type in ['comprehensive', 'recommendations']:
                best_practices = self.generate_best_practice_recommendations(experiment_ids)
                report['sections']['best_practices'] = {
                    'title': 'Best Practice Recommendations',
                    'recommendations': [asdict(rec) for rec in best_practices],
                    'top_recommendations': [asdict(rec) for rec in best_practices[:5]]
                }
            
            # Experiment Comparison Section
            if len(experiment_ids) >= 2 and report_type in ['comprehensive', 'comparison']:
                comparison = self.compare_experiment_performance(experiment_ids)
                report['sections']['comparison'] = {
                    'title': 'Experiment Performance Comparison',
                    'comparison': asdict(comparison),
                    'winner_analysis': self._analyze_winner_characteristics(comparison)
                }
            
            # Key Insights Generation
            report['summary']['key_insights'] = self._generate_report_insights(report)
            
            # Save report
            report_file = os.path.join(self.reports_path, f"report_{report['report_id']}.json")
            with open(report_file, 'w') as f:
                json.dump(report, f, indent=2, default=str)
            
            logger.info(f"Generated automated report {report['report_id']} for {len(experiment_ids)} experiments")
            
        except Exception as e:
            logger.error(f"Failed to generate automated report: {e}")
            report['error'] = str(e)
        
        return report
    
    # Helper methods for analysis
    
    def _detect_seasonal_pattern(self, values: List[float], timestamps: List[float]) -> bool:
        """Detect if there's a seasonal pattern in the data."""
        if len(values) < 20:  # Need sufficient data points
            return False
        
        try:
            # Simple periodicity detection using autocorrelation
            from scipy.signal import find_peaks
            
            # Calculate autocorrelation
            correlation = np.correlate(values, values, mode='full')
            correlation = correlation[correlation.size // 2:]
            
            # Find peaks
            peaks, _ = find_peaks(correlation[1:], height=0.5 * max(correlation))
            
            return len(peaks) > 0
        
        except Exception:
            return False
    
    def _generate_trend_predictions(self, 
                                   values: List[float], 
                                   timestamps: List[float],
                                   slope: float,
                                   intercept: float,
                                   std_err: float,
                                   prediction_steps: int = 5) -> Tuple[List[Dict[str, Any]], Tuple[float, float]]:
        """Generate future predictions based on trend analysis."""
        
        predictions = []
        last_timestamp = max(timestamps)
        time_step = (max(timestamps) - min(timestamps)) / len(timestamps) if len(timestamps) > 1 else 3600
        
        for i in range(1, prediction_steps + 1):
            future_timestamp = last_timestamp + (time_step * i)
            predicted_value = slope * future_timestamp + intercept
            
            predictions.append({
                'step': i,
                'predicted_value': predicted_value,
                'timestamp_offset_seconds': time_step * i
            })
        
        # Calculate confidence interval
        last_value = values[-1]
        confidence_interval = (
            last_value - (2 * std_err),
            last_value + (2 * std_err)
        )
        
        return predictions, confidence_interval
    
    def _calculate_cpu_efficiency(self, resource_usage: ResourceUsage) -> float:
        """Calculate CPU efficiency score (0-1)."""
        if not resource_usage.cpu_usage_percent:
            return 0.0
        
        avg_cpu = resource_usage.avg_cpu_usage
        
        # Optimal CPU usage is around 70-90%
        if 70 <= avg_cpu <= 90:
            return 1.0
        elif avg_cpu < 70:
            return avg_cpu / 70  # Penalize low utilization
        else:
            return max(0.0, 1.0 - ((avg_cpu - 90) / 10))  # Penalize over-utilization
    
    def _calculate_memory_efficiency(self, resource_usage: ResourceUsage) -> float:
        """Calculate memory efficiency score (0-1)."""
        if not resource_usage.memory_usage_gb:
            return 0.0
        
        peak_memory = resource_usage.peak_memory_usage
        
        # Assume reasonable memory usage is up to 8GB for most experiments
        optimal_memory = 8.0
        
        if peak_memory <= optimal_memory:
            return 1.0 - (peak_memory / optimal_memory * 0.2)  # Small penalty for high usage
        else:
            return max(0.0, 1.0 - ((peak_memory - optimal_memory) / optimal_memory))
    
    def _calculate_gpu_efficiency(self, resource_usage: ResourceUsage) -> float:
        """Calculate GPU efficiency score (0-1)."""
        if not resource_usage.gpu_usage_percent:
            return 1.0  # No GPU usage is fine
        
        avg_gpu = resource_usage.avg_gpu_usage
        
        if avg_gpu == 0:
            return 1.0
        
        # Optimal GPU usage is around 80-95%
        if 80 <= avg_gpu <= 95:
            return 1.0
        elif avg_gpu < 80:
            return avg_gpu / 80
        else:
            return max(0.0, 1.0 - ((avg_gpu - 95) / 5))
    
    def _calculate_time_efficiency(self, resource_usage: ResourceUsage, performance: Dict[str, float]) -> float:
        """Calculate time efficiency score based on training time vs performance."""
        if resource_usage.training_time_seconds == 0:
            return 0.0
        
        # Performance per hour metric
        avg_performance = statistics.mean(performance.values()) if performance else 0.5
        training_hours = resource_usage.training_time_seconds / 3600
        
        performance_per_hour = avg_performance / training_hours if training_hours > 0 else 0
        
        # Normalize to 0-1 scale (assuming good performance per hour is around 0.1)
        return min(1.0, performance_per_hour / 0.1)
    
    def _calculate_cost_efficiency(self, resource_usage: ResourceUsage) -> Optional[float]:
        """Calculate cost efficiency if cost data is available."""
        # This would require actual cost data from cloud providers
        # Placeholder implementation
        return resource_usage.total_compute_cost if hasattr(resource_usage, 'total_compute_cost') else None
    
    def _calculate_carbon_efficiency(self, resource_usage: ResourceUsage) -> Optional[float]:
        """Calculate carbon efficiency if emissions data is available."""
        # This would require actual carbon emissions data
        # Placeholder implementation
        return resource_usage.carbon_emissions_kg if hasattr(resource_usage, 'carbon_emissions_kg') else None
    
    def _generate_efficiency_recommendations(self,
                                           resource_usage: ResourceUsage,
                                           cpu_eff: float,
                                           memory_eff: float,
                                           gpu_eff: float,
                                           time_eff: float) -> List[str]:
        """Generate efficiency improvement recommendations."""
        
        recommendations = []
        
        if cpu_eff < 0.6:
            if resource_usage.avg_cpu_usage < 50:
                recommendations.append("Increase batch size or number of parallel workers to improve CPU utilization")
            else:
                recommendations.append("Consider optimizing CPU-intensive operations or reducing computational complexity")
        
        if memory_eff < 0.6:
            recommendations.append("Optimize memory usage by reducing batch size, using gradient checkpointing, or data streaming")
        
        if gpu_eff < 0.6 and resource_usage.avg_gpu_usage > 0:
            if resource_usage.avg_gpu_usage < 60:
                recommendations.append("Increase model size or batch size to better utilize GPU resources")
            else:
                recommendations.append("Optimize GPU memory usage and computation patterns")
        
        if time_eff < 0.6:
            recommendations.append("Implement early stopping, learning rate scheduling, or model pruning to reduce training time")
        
        if not recommendations:
            recommendations.append("Resource usage appears well-optimized")
        
        return recommendations
    
    def _compare_to_benchmarks(self, experiment_id: str, resource_usage: ResourceUsage) -> Dict[str, float]:
        """Compare resource usage to benchmarks."""
        
        # Load or create benchmarks
        experiment_type = self.experiment_tracker._active_experiments.get(experiment_id, {}).get('experiment_type', 'unknown')
        
        if experiment_type not in self._resource_benchmarks:
            # Create default benchmarks
            self._resource_benchmarks[experiment_type] = {
                'avg_cpu_usage': 70.0,
                'peak_memory_gb': 4.0,
                'avg_gpu_usage': 85.0,
                'training_time_hours': 2.0
            }
        
        benchmarks = self._resource_benchmarks[experiment_type]
        comparison = {}
        
        # Compare actual vs benchmark (ratio)
        comparison['cpu_vs_benchmark'] = (resource_usage.avg_cpu_usage / benchmarks['avg_cpu_usage']) if benchmarks['avg_cpu_usage'] > 0 else 1.0
        comparison['memory_vs_benchmark'] = (resource_usage.peak_memory_usage / benchmarks['peak_memory_gb']) if benchmarks['peak_memory_gb'] > 0 else 1.0
        comparison['gpu_vs_benchmark'] = (resource_usage.avg_gpu_usage / benchmarks['avg_gpu_usage']) if benchmarks['avg_gpu_usage'] > 0 else 1.0
        comparison['time_vs_benchmark'] = ((resource_usage.training_time_seconds / 3600) / benchmarks['training_time_hours']) if benchmarks['training_time_hours'] > 0 else 1.0
        
        return comparison
    
    def _analyze_hyperparameter_patterns(self, 
                                        successful_experiments: List[Dict], 
                                        failed_experiments: List[Dict]) -> List[BestPracticeRecommendation]:
        """Analyze hyperparameter patterns from successful vs failed experiments."""
        
        recommendations = []
        
        # Collect hyperparameters from successful experiments
        successful_hps = defaultdict(list)
        failed_hps = defaultdict(list)
        
        for exp in successful_experiments:
            hps = exp['insights'].best_hyperparameters
            for param, value in hps.items():
                if isinstance(value, (int, float)):
                    successful_hps[param].append(value)
        
        for exp in failed_experiments:
            hps = exp['insights'].best_hyperparameters
            for param, value in hps.items():
                if isinstance(value, (int, float)):
                    failed_hps[param].append(value)
        
        # Find patterns
        for param in successful_hps:
            if param in failed_hps and len(successful_hps[param]) >= 3:
                successful_values = successful_hps[param]
                failed_values = failed_hps[param]
                
                # Statistical test
                try:
                    t_stat, p_value = stats.ttest_ind(successful_values, failed_values)
                    
                    if p_value < 0.05:  # Statistically significant difference
                        successful_mean = statistics.mean(successful_values)
                        failed_mean = statistics.mean(failed_values)
                        
                        improvement = abs(successful_mean - failed_mean) / failed_mean * 100 if failed_mean != 0 else 0
                        
                        if improvement > 10:  # Significant improvement
                            recommendation = BestPracticeRecommendation(
                                category='hyperparameters',
                                recommendation=f"Use {param} around {successful_mean:.4f} instead of {failed_mean:.4f}",
                                confidence=min(0.95, 1 - p_value),
                                supporting_experiments=[exp['experiment_id'] for exp in successful_experiments if param in exp['insights'].best_hyperparameters],
                                expected_improvement=improvement,
                                implementation_difficulty='easy'
                            )
                            recommendations.append(recommendation)
                
                except Exception as e:
                    logger.warning(f"Could not analyze hyperparameter {param}: {e}")
        
        return recommendations
    
    def _analyze_architecture_patterns(self, 
                                      successful_experiments: List[Dict], 
                                      failed_experiments: List[Dict]) -> List[BestPracticeRecommendation]:
        """Analyze architecture patterns from experiments."""
        
        recommendations = []
        
        # Analyze model configurations
        successful_configs = [exp['config'].get('model_configs', []) for exp in successful_experiments]
        failed_configs = [exp['config'].get('model_configs', []) for exp in failed_experiments]
        
        # Find common patterns in successful experiments
        successful_architectures = defaultdict(int)
        failed_architectures = defaultdict(int)
        
        for configs in successful_configs:
            for config in configs:
                arch_type = config.get('model_type', 'unknown')
                framework = config.get('framework', 'unknown')
                key = f"{framework}_{arch_type}"
                successful_architectures[key] += 1
        
        for configs in failed_configs:
            for config in configs:
                arch_type = config.get('model_type', 'unknown')
                framework = config.get('framework', 'unknown')
                key = f"{framework}_{arch_type}"
                failed_architectures[key] += 1
        
        # Find architectures with high success rates
        for arch, success_count in successful_architectures.items():
            total_count = success_count + failed_architectures.get(arch, 0)
            if total_count >= 3:  # Minimum sample size
                success_rate = success_count / total_count
                
                if success_rate >= 0.8:  # High success rate
                    recommendation = BestPracticeRecommendation(
                        category='architecture',
                        recommendation=f"Consider using {arch.replace('_', ' ')} architecture (success rate: {success_rate:.1%})",
                        confidence=success_rate,
                        supporting_experiments=[],  # Would need to track experiment IDs
                        expected_improvement=success_rate * 100,
                        implementation_difficulty='medium'
                    )
                    recommendations.append(recommendation)
        
        return recommendations
    
    def _analyze_training_patterns(self, 
                                  successful_experiments: List[Dict], 
                                  failed_experiments: List[Dict]) -> List[BestPracticeRecommendation]:
        """Analyze training patterns and configurations."""
        
        recommendations = []
        
        # Analyze convergence patterns
        successful_convergence = []
        failed_convergence = []
        
        for exp in successful_experiments:
            convergence_analysis = exp['insights'].convergence_analysis
            for metric, analysis in convergence_analysis.items():
                if analysis.get('is_converged'):
                    successful_convergence.append(analysis)
        
        for exp in failed_experiments:
            convergence_analysis = exp['insights'].convergence_analysis
            for metric, analysis in convergence_analysis.items():
                if not analysis.get('is_converged'):
                    failed_convergence.append(analysis)
        
        if len(successful_convergence) > len(failed_convergence) * 2:
            recommendation = BestPracticeRecommendation(
                category='training',
                recommendation="Implement convergence monitoring and early stopping to improve training efficiency",
                confidence=0.8,
                supporting_experiments=[exp['experiment_id'] for exp in successful_experiments],
                expected_improvement=25.0,
                implementation_difficulty='easy'
            )
            recommendations.append(recommendation)
        
        # Analyze training duration patterns
        successful_durations = []
        failed_durations = []
        
        for exp in successful_experiments:
            resource_data = exp['config'].get('resource_usage', {})
            if resource_data:
                duration = resource_data.get('training_time_seconds', 0) / 3600  # hours
                successful_durations.append(duration)
        
        for exp in failed_experiments:
            resource_data = exp['config'].get('resource_usage', {})
            if resource_data:
                duration = resource_data.get('training_time_seconds', 0) / 3600  # hours
                failed_durations.append(duration)
        
        if successful_durations and failed_durations:
            avg_successful = statistics.mean(successful_durations)
            avg_failed = statistics.mean(failed_durations)
            
            if avg_successful < avg_failed * 0.8:  # Successful experiments are significantly shorter
                recommendation = BestPracticeRecommendation(
                    category='training',
                    recommendation=f"Optimal training duration appears to be around {avg_successful:.1f} hours",
                    confidence=0.7,
                    supporting_experiments=[exp['experiment_id'] for exp in successful_experiments],
                    expected_improvement=15.0,
                    implementation_difficulty='easy'
                )
                recommendations.append(recommendation)
        
        return recommendations
    
    def _analyze_data_patterns(self, 
                              successful_experiments: List[Dict], 
                              failed_experiments: List[Dict]) -> List[BestPracticeRecommendation]:
        """Analyze data-related patterns."""
        
        recommendations = []
        
        # Analyze dataset configurations
        successful_datasets = [exp['config'].get('dataset_config', {}) for exp in successful_experiments]
        failed_datasets = [exp['config'].get('dataset_config', {}) for exp in failed_experiments]
        
        # Simple pattern analysis for data preprocessing
        successful_preprocessing = defaultdict(int)
        failed_preprocessing = defaultdict(int)
        
        for dataset in successful_datasets:
            preprocessing = dataset.get('preprocessing', [])
            if isinstance(preprocessing, list):
                for step in preprocessing:
                    successful_preprocessing[step] += 1
        
        for dataset in failed_datasets:
            preprocessing = dataset.get('preprocessing', [])
            if isinstance(preprocessing, list):
                for step in preprocessing:
                    failed_preprocessing[step] += 1
        
        # Find preprocessing steps that correlate with success
        for step, success_count in successful_preprocessing.items():
            total_count = success_count + failed_preprocessing.get(step, 0)
            if total_count >= 3:
                success_rate = success_count / total_count
                
                if success_rate >= 0.8:
                    recommendation = BestPracticeRecommendation(
                        category='data',
                        recommendation=f"Include {step} in data preprocessing pipeline (success rate: {success_rate:.1%})",
                        confidence=success_rate,
                        supporting_experiments=[exp['experiment_id'] for exp in successful_experiments],
                        expected_improvement=success_rate * 100,
                        implementation_difficulty='medium'
                    )
                    recommendations.append(recommendation)
        
        return recommendations
    
    def _calculate_experiment_diversity(self, experiment_configs: List[Dict]) -> float:
        """Calculate diversity score for experiment portfolio."""
        
        if not experiment_configs:
            return 0.0
        
        # Analyze diversity across different dimensions
        model_types = set()
        frameworks = set()
        optimization_methods = set()
        
        for config in experiment_configs:
            # Model diversity
            model_configs = config.get('model_configs', [])
            for model_config in model_configs:
                model_types.add(model_config.get('model_type', 'unknown'))
                frameworks.add(model_config.get('framework', 'unknown'))
            
            # Optimization diversity
            optimization_methods.add(config.get('optimization_method', 'unknown'))
        
        # Diversity score based on unique approaches
        diversity_factors = [
            len(model_types) / len(experiment_configs),
            len(frameworks) / len(experiment_configs),
            len(optimization_methods) / len(experiment_configs)
        ]
        
        return statistics.mean(diversity_factors)
    
    def _calculate_exploration_exploitation_balance(self, experiment_configs: List[Dict]) -> float:
        """Calculate exploration vs exploitation balance."""
        
        if not experiment_configs:
            return 0.5
        
        # Simple heuristic: count experiments with similar configs vs diverse configs
        similar_experiments = 0
        total_comparisons = 0
        
        for i, config1 in enumerate(experiment_configs):
            for j, config2 in enumerate(experiment_configs[i+1:], i+1):
                total_comparisons += 1
                
                # Simple similarity check based on model types
                config1_models = set(mc.get('model_type', 'unknown') for mc in config1.get('model_configs', []))
                config2_models = set(mc.get('model_type', 'unknown') for mc in config2.get('model_configs', []))
                
                similarity = len(config1_models & config2_models) / len(config1_models | config2_models) if config1_models | config2_models else 0
                
                if similarity > 0.7:  # Similar experiments (exploitation)
                    similar_experiments += 1
        
        if total_comparisons == 0:
            return 0.5
        
        exploitation_ratio = similar_experiments / total_comparisons
        exploration_ratio = 1 - exploitation_ratio
        
        # Balanced is around 0.3-0.7 exploitation ratio
        if 0.3 <= exploitation_ratio <= 0.7:
            return 1.0  # Well balanced
        elif exploitation_ratio < 0.3:
            return 0.5 + (exploitation_ratio / 0.3) * 0.5  # Too much exploration
        else:
            return 0.5 + ((1 - exploitation_ratio) / 0.3) * 0.5  # Too much exploitation
    
    def _calculate_portfolio_health_score(self, 
                                         success_rate: float,
                                         avg_performance: float,
                                         diversity: float,
                                         balance: float) -> float:
        """Calculate overall portfolio health score."""
        
        # Weighted combination of factors
        weights = {
            'success_rate': 0.4,
            'avg_performance': 0.3,
            'diversity': 0.15,
            'balance': 0.15
        }
        
        health_score = (
            success_rate * weights['success_rate'] +
            avg_performance * weights['avg_performance'] +
            diversity * weights['diversity'] +
            balance * weights['balance']
        )
        
        return min(1.0, max(0.0, health_score))
    
    def _generate_portfolio_recommendations(self,
                                          success_rate: float,
                                          avg_performance: float,
                                          diversity: float,
                                          balance: float,
                                          performance_dist: Dict[str, int],
                                          resource_usage: Dict[str, float]) -> List[BestPracticeRecommendation]:
        """Generate portfolio-level recommendations."""
        
        recommendations = []
        
        # Success rate recommendations
        if success_rate < 0.5:
            recommendations.append(BestPracticeRecommendation(
                category='portfolio',
                recommendation="Success rate is low. Focus on proven approaches and incremental improvements",
                confidence=0.9,
                supporting_experiments=[],
                expected_improvement=30.0,
                implementation_difficulty='medium'
            ))
        
        # Performance recommendations
        if avg_performance < 0.7:
            recommendations.append(BestPracticeRecommendation(
                category='portfolio',
                recommendation="Average performance is below target. Increase focus on high-performance architectures",
                confidence=0.8,
                supporting_experiments=[],
                expected_improvement=25.0,
                implementation_difficulty='medium'
            ))
        
        # Diversity recommendations
        if diversity < 0.3:
            recommendations.append(BestPracticeRecommendation(
                category='portfolio',
                recommendation="Low experiment diversity. Explore different model architectures and approaches",
                confidence=0.7,
                supporting_experiments=[],
                expected_improvement=20.0,
                implementation_difficulty='easy'
            ))
        elif diversity > 0.8:
            recommendations.append(BestPracticeRecommendation(
                category='portfolio',
                recommendation="High diversity might be reducing focus. Consider consolidating successful approaches",
                confidence=0.6,
                supporting_experiments=[],
                expected_improvement=15.0,
                implementation_difficulty='easy'
            ))
        
        # Balance recommendations
        if balance < 0.5:
            if balance < 0.3:  # Too much exploration
                recommendations.append(BestPracticeRecommendation(
                    category='portfolio',
                    recommendation="Too much exploration. Focus more on exploiting successful patterns",
                    confidence=0.7,
                    supporting_experiments=[],
                    expected_improvement=20.0,
                    implementation_difficulty='easy'
                ))
            else:  # Too much exploitation
                recommendations.append(BestPracticeRecommendation(
                    category='portfolio',
                    recommendation="Too much exploitation. Increase exploration of new approaches",
                    confidence=0.7,
                    supporting_experiments=[],
                    expected_improvement=20.0,
                    implementation_difficulty='easy'
                ))
        
        return recommendations
    
    def _generate_trend_insights(self, trend_analyses: List[TrendAnalysis]) -> List[str]:
        """Generate insights from trend analyses."""
        
        insights = []
        
        for trend in trend_analyses:
            if trend.trend_direction == 'improving' and trend.trend_strength > 0.7:
                insights.append(f"{trend.metric_name} shows strong improvement trend ({trend.trend_strength:.2f})")
            elif trend.trend_direction == 'declining' and trend.trend_strength > 0.5:
                insights.append(f"{trend.metric_name} shows concerning decline trend - investigate causes")
            
            if trend.volatility > 0.3:
                insights.append(f"{trend.metric_name} shows high volatility - consider stabilization techniques")
            
            if trend.seasonal_pattern:
                insights.append(f"{trend.metric_name} shows seasonal patterns - consider time-based factors")
        
        return insights
    
    def _analyze_winner_characteristics(self, comparison: PerformanceComparison) -> Dict[str, Any]:
        """Analyze characteristics of the winning experiment."""
        
        if not self.experiment_tracker:
            return {}
        
        winner_id = comparison.winner
        
        try:
            winner_experiment = self.experiment_tracker._active_experiments.get(winner_id, {})
            winner_insights = self.experiment_tracker.get_experiment_insights(winner_id)
            
            analysis = {
                'winner_id': winner_id,
                'winner_name': winner_experiment.get('name', 'Unknown'),
                'key_characteristics': {
                    'model_configs': winner_experiment.get('model_configs', []),
                    'hyperparameters': winner_insights.best_hyperparameters,
                    'efficiency_score': winner_insights.efficiency_score,
                    'convergence_quality': len([a for a in winner_insights.convergence_analysis.values() 
                                              if a.get('is_converged', False)])
                },
                'success_factors': []
            }
            
            # Identify success factors
            if winner_insights.efficiency_score > 0.8:
                analysis['success_factors'].append('High resource efficiency')
            
            if len([a for a in winner_insights.convergence_analysis.values() if a.get('is_converged', False)]) > 0:
                analysis['success_factors'].append('Good convergence behavior')
            
            if comparison.statistical_significance > 0.95:
                analysis['success_factors'].append('Statistically significant improvement')
            
            return analysis
        
        except Exception as e:
            logger.warning(f"Could not analyze winner characteristics: {e}")
            return {}
    
    def _generate_report_insights(self, report: Dict[str, Any]) -> List[str]:
        """Generate key insights from the complete report."""
        
        insights = []
        
        # Portfolio insights
        summary = report['summary']
        if summary.get('success_rate', 0) > 0.8:
            insights.append(f"Excellent success rate of {summary['success_rate']:.1%}")
        elif summary.get('success_rate', 0) < 0.5:
            insights.append(f"Low success rate of {summary['success_rate']:.1%} needs attention")
        
        if summary.get('portfolio_health', 0) > 0.8:
            insights.append("Portfolio is in excellent health")
        elif summary.get('portfolio_health', 0) < 0.6:
            insights.append("Portfolio health needs improvement")
        
        # Trend insights
        if 'trends' in report['sections']:
            improving_trends = len([t for t in report['sections']['trends']['trends'] 
                                  if t.get('trend_direction') == 'improving'])
            if improving_trends > 0:
                insights.append(f"{improving_trends} metrics showing improvement trends")
        
        # Efficiency insights
        if 'efficiency' in report['sections']:
            avg_efficiency = report['sections']['efficiency'].get('avg_efficiency', 0)
            if avg_efficiency > 0.8:
                insights.append("Resource efficiency is excellent")
            elif avg_efficiency < 0.6:
                insights.append("Resource efficiency has room for improvement")
        
        # Best practices insights
        if 'best_practices' in report['sections']:
            high_confidence_recs = len([r for r in report['sections']['best_practices']['recommendations'] 
                                       if r.get('confidence', 0) > 0.8])
            if high_confidence_recs > 0:
                insights.append(f"{high_confidence_recs} high-confidence recommendations identified")
        
        return insights
    
    def _load_benchmarks(self):
        """Load performance and resource benchmarks from storage."""
        
        try:
            perf_benchmark_file = os.path.join(self.benchmarks_path, "performance_benchmarks.json")
            if os.path.exists(perf_benchmark_file):
                with open(perf_benchmark_file, 'r') as f:
                    self._performance_benchmarks = json.load(f)
            
            resource_benchmark_file = os.path.join(self.benchmarks_path, "resource_benchmarks.json")
            if os.path.exists(resource_benchmark_file):
                with open(resource_benchmark_file, 'r') as f:
                    self._resource_benchmarks = json.load(f)
            
            logger.info(f"Loaded benchmarks: {len(self._performance_benchmarks)} performance, "
                       f"{len(self._resource_benchmarks)} resource")
        
        except Exception as e:
            logger.warning(f"Could not load benchmarks: {e}")