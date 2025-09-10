'use client'

import { CheckCircleIcon, ExclamationTriangleIcon, LightBulbIcon, ClockIcon } from '@heroicons/react/24/outline'
import { CodeBlock } from '../../../components/ui/CodeBlock'

export default function MLOpsWorkflowsPage() {
  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">MLOps Workflow Best Practices</h1>
        <p className="text-gray-600 text-lg">
          Comprehensive guide to implementing production-ready MLOps workflows with Schlep Engine, 
          covering everything from experimentation to deployment and monitoring.
        </p>
      </div>

      {/* Overview */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-8 border border-blue-100">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">MLOps Lifecycle Overview</h2>
        <div className="grid md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-600 text-white rounded-lg flex items-center justify-center mx-auto mb-3">
              1
            </div>
            <h3 className="font-medium text-gray-900">Experimentation</h3>
            <p className="text-sm text-gray-600 mt-1">Data prep, feature engineering, model training</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-green-600 text-white rounded-lg flex items-center justify-center mx-auto mb-3">
              2
            </div>
            <h3 className="font-medium text-gray-900">Deployment</h3>
            <p className="text-sm text-gray-600 mt-1">Model serving, A/B testing, rollout</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-orange-600 text-white rounded-lg flex items-center justify-center mx-auto mb-3">
              3
            </div>
            <h3 className="font-medium text-gray-900">Monitoring</h3>
            <p className="text-sm text-gray-600 mt-1">Performance tracking, drift detection</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-600 text-white rounded-lg flex items-center justify-center mx-auto mb-3">
              4
            </div>
            <h3 className="font-medium text-gray-900">Retraining</h3>
            <p className="text-sm text-gray-600 mt-1">Automated retraining, continuous improvement</p>
          </div>
        </div>
      </div>

      {/* Phase 1: Experimentation Workflow */}
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Phase 1: Experimentation Workflow</h2>
        
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <CheckCircleIcon className="h-5 w-5 text-green-600 mr-2" />
              Data Preparation Best Practices
            </h3>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">1. Dataset Quality Assessment</h4>
                <CodeBlock
                  code={`# Dataset quality assessment workflow
from schlep_engine import Datasets, DataQuality

datasets = Datasets(api_key="your_api_key")

# Upload and assess dataset quality
dataset = datasets.upload(
    data=raw_data,
    name="sales_forecasting_v1",
    description="Q1-Q3 sales data with seasonality"
)

# Automated quality assessment
quality_report = datasets.assess_quality(
    dataset_id=dataset.dataset_id,
    checks=[
        "missing_values",
        "data_drift", 
        "outlier_detection",
        "schema_validation",
        "feature_correlation"
    ]
)

# Quality gates - block training if quality is poor
if quality_report.overall_score < 0.8:
    raise ValueError(f"Dataset quality too low: {quality_report.overall_score}")

print(f"Dataset quality score: {quality_report.overall_score}")
print(f"Issues found: {len(quality_report.issues)}")

# Address quality issues before proceeding
for issue in quality_report.issues:
    if issue.severity == "high":
        print(f"Critical issue: {issue.description}")
        # Implement fix or flag for manual review`}
                  language="python"
                />
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">2. Feature Engineering Pipeline</h4>
                <CodeBlock
                  code={`# Feature engineering best practices
from schlep_engine import FeatureStore

feature_store = FeatureStore(api_key="your_api_key")

# Define reusable feature transformations
feature_pipeline = feature_store.create_pipeline(
    name="sales_features_v1",
    transformations=[
        {
            "type": "time_features",
            "config": {
                "datetime_column": "order_date",
                "features": ["day_of_week", "month", "quarter", "is_weekend"]
            }
        },
        {
            "type": "rolling_aggregates", 
            "config": {
                "columns": ["sales_amount"],
                "windows": [7, 30, 90],
                "operations": ["mean", "std", "min", "max"]
            }
        },
        {
            "type": "categorical_encoding",
            "config": {
                "columns": ["product_category", "region"],
                "method": "target_encoding",
                "regularization": 0.1
            }
        }
    ]
)

# Apply feature pipeline with validation
features = feature_pipeline.transform(
    data=dataset,
    validate=True,  # Ensure feature quality
    cache=True      # Cache for reuse
)

# Feature importance and selection
feature_analysis = feature_store.analyze_features(
    features=features,
    target="sales_amount",
    methods=["mutual_info", "correlation", "permutation"]
)

# Select top features based on analysis
selected_features = feature_analysis.select_features(
    method="recursive_elimination",
    max_features=50,
    min_importance=0.01
)`}
                  language="python"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <LightBulbIcon className="h-5 w-5 text-blue-600 mr-2" />
              Experiment Management Strategy
            </h3>
            
            <CodeBlock
              code={`# Comprehensive experiment management
from schlep_engine import Experiments, MLOps

experiments = Experiments(api_key="your_api_key")
mlops = MLOps(api_key="your_api_key")

# Create experiment with metadata
experiment = experiments.create(
    name="sales_forecasting_q4_2024",
    description="Q4 sales forecasting with new feature engineering",
    tags=["sales", "forecasting", "production"],
    metadata={
        "business_metric": "revenue_impact",
        "stakeholder": "sales_team",
        "deadline": "2024-12-01",
        "success_criteria": {
            "min_accuracy": 0.85,
            "max_inference_time": "100ms",
            "business_impact": "5%_revenue_increase"
        }
    }
)

# Hyperparameter search strategy
param_grid = {
    "model_type": ["xgboost", "random_forest", "neural_network"],
    "xgboost": {
        "n_estimators": [100, 200, 500],
        "learning_rate": [0.01, 0.1, 0.2],
        "max_depth": [3, 6, 9]
    },
    "random_forest": {
        "n_estimators": [100, 200, 500],
        "max_depth": [10, 20, None],
        "min_samples_split": [2, 5, 10]
    }
}

# Run systematic hyperparameter optimization
for model_type in param_grid["model_type"]:
    model_params = param_grid[model_type]
    
    # Create child experiment for each model type
    model_experiment = experiments.create_child(
        parent_id=experiment.experiment_id,
        name=f"{experiment.name}_{model_type}",
        metadata={"model_type": model_type}
    )
    
    # Bayesian optimization for hyperparameter search
    optimization = experiments.optimize_hyperparameters(
        experiment_id=model_experiment.experiment_id,
        parameter_space=model_params,
        objective="accuracy",
        n_trials=20,
        strategy="bayesian"
    )
    
    # Track all trials automatically
    for trial in optimization.trials:
        experiments.log_trial(
            experiment_id=model_experiment.experiment_id,
            params=trial.params,
            metrics=trial.metrics,
            artifacts=trial.artifacts
        )

# Compare experiments and select best model
comparison = experiments.compare([
    exp.experiment_id for exp in experiments.list_children(experiment.experiment_id)
])

best_experiment = comparison.get_best(
    metric="accuracy",
    minimize=False
)

print(f"Best model: {best_experiment.metadata['model_type']}")
print(f"Best accuracy: {best_experiment.best_metrics['accuracy']}")

# Promote best experiment to production candidate
experiments.promote_to_production(
    experiment_id=best_experiment.experiment_id,
    stage="candidate"
)`}
              language="python"
            />
          </div>
        </div>
      </section>

      {/* Phase 2: Deployment Workflow */}
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Phase 2: Deployment Workflow</h2>
        
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <CheckCircleIcon className="h-5 w-5 text-green-600 mr-2" />
              Progressive Deployment Strategy
            </h3>
            
            <CodeBlock
              code={`# Progressive deployment with safety gates
from schlep_engine import ModelServing, Experiments

serving = ModelServing(api_key="your_api_key")

# Stage 1: Shadow deployment for validation
shadow_deployment = serving.deploy(
    model_id=best_experiment.model_id,
    deployment_config={
        "name": "sales_forecast_shadow_v1",
        "mode": "shadow",  # No live traffic
        "instance_type": "t3.medium", 
        "min_replicas": 1,
        "max_replicas": 3,
        "health_check": {
            "path": "/health",
            "interval_seconds": 30
        }
    }
)

# Validate shadow deployment with production data
validation_results = serving.validate_deployment(
    deployment_id=shadow_deployment.deployment_id,
    validation_config={
        "duration_hours": 24,
        "sample_rate": 0.1,  # 10% of production traffic
        "metrics": [
            "latency_p95",
            "error_rate", 
            "prediction_drift",
            "business_metric_correlation"
        ],
        "thresholds": {
            "latency_p95": "< 100ms",
            "error_rate": "< 0.1%",
            "prediction_drift": "< 0.05"
        }
    }
)

if not validation_results.passed:
    print("Shadow deployment validation failed:")
    for failure in validation_results.failures:
        print(f"  - {failure.metric}: {failure.value} (threshold: {failure.threshold})")
    
    # Rollback and investigate
    serving.delete_deployment(shadow_deployment.deployment_id)
    exit(1)

# Stage 2: Canary deployment with 5% traffic
canary_deployment = serving.deploy(
    model_id=best_experiment.model_id,
    deployment_config={
        "name": "sales_forecast_canary_v1",
        "mode": "canary",
        "traffic_percent": 5,
        "canary_config": {
            "duration_hours": 48,
            "success_criteria": {
                "min_requests": 1000,
                "max_error_rate": 0.005,
                "max_latency_p95": 80,
                "min_business_metric_lift": 0.02
            }
        }
    }
)

# Monitor canary deployment
canary_monitor = serving.monitor_canary(
    deployment_id=canary_deployment.deployment_id,
    alert_channels=["slack", "email"],
    auto_rollback=True
)

# Wait for canary validation
canary_results = canary_monitor.wait_for_completion()

if canary_results.status == "success":
    # Stage 3: Full deployment
    production_deployment = serving.promote_canary(
        canary_id=canary_deployment.deployment_id,
        production_config={
            "traffic_percent": 100,
            "instance_type": "c5.large",
            "min_replicas": 3,
            "max_replicas": 20,
            "auto_scaling": {
                "target_cpu": 70,
                "scale_up_cooldown": 60,
                "scale_down_cooldown": 300
            }
        }
    )
    
    print(f"Successfully deployed to production: {production_deployment.endpoint}")
else:
    print(f"Canary deployment failed: {canary_results.failure_reason}")
    serving.rollback_canary(canary_deployment.deployment_id)`}
              language="python"
            />
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 text-orange-600 mr-2" />
              A/B Testing Framework
            </h3>
            
            <CodeBlock
              code={`# A/B testing for model comparison
from schlep_engine import ABTesting

ab_testing = ABTesting(api_key="your_api_key")

# Create A/B test comparing models
ab_test = ab_testing.create_test(
    name="sales_forecast_model_comparison_v1_v2",
    description="Compare new feature engineering vs baseline",
    test_config={
        "variants": [
            {
                "name": "control",
                "model_id": current_production_model_id,
                "traffic_percent": 50,
                "metadata": {"version": "v1.2", "features": "baseline"}
            },
            {
                "name": "treatment", 
                "model_id": best_experiment.model_id,
                "traffic_percent": 50,
                "metadata": {"version": "v2.0", "features": "enhanced"}
            }
        ],
        "success_metrics": [
            {
                "name": "prediction_accuracy",
                "type": "higher_is_better",
                "minimum_detectable_effect": 0.02
            },
            {
                "name": "business_conversion_rate",
                "type": "higher_is_better", 
                "minimum_detectable_effect": 0.01
            },
            {
                "name": "inference_latency_p95",
                "type": "lower_is_better",
                "maximum_acceptable_value": 100
            }
        ],
        "sample_size": {
            "method": "power_analysis",
            "statistical_power": 0.8,
            "significance_level": 0.05
        },
        "duration": {
            "min_days": 14,
            "max_days": 30,
            "early_stopping": True
        }
    }
)

# Monitor A/B test progress
test_monitor = ab_testing.create_monitor(
    test_id=ab_test.test_id,
    monitoring_config={
        "check_interval_hours": 6,
        "alert_on_significant_difference": True,
        "alert_on_degradation": True,
        "guardrail_metrics": [
            {"name": "error_rate", "threshold": 0.01},
            {"name": "latency_p95", "threshold": 150}
        ]
    }
)

# Automated analysis and decision making
analysis = ab_testing.analyze_test(ab_test.test_id)

if analysis.is_conclusive:
    winning_variant = analysis.winning_variant
    
    print(f"Test conclusive! Winner: {winning_variant.name}")
    print(f"Confidence: {analysis.confidence:.2%}")
    print(f"Effect size: {analysis.effect_size:.3f}")
    
    # Automatically promote winner if meets criteria
    if (analysis.confidence > 0.95 and 
        analysis.effect_size > ab_test.minimum_detectable_effect):
        
        promotion = ab_testing.promote_winner(
            test_id=ab_test.test_id,
            variant_name=winning_variant.name,
            promotion_config={
                "rollout_strategy": "gradual",
                "rollout_duration_hours": 24,
                "monitoring_duration_hours": 72
            }
        )
        
        print(f"Promoting winner to production: {promotion.deployment_id}")
    
else:
    print(f"Test still running... Current sample size: {analysis.current_sample_size}")
    print(f"Estimated completion: {analysis.estimated_completion}")`}
              language="python"
            />
          </div>
        </div>
      </section>

      {/* Phase 3: Monitoring Workflow */}
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Phase 3: Monitoring & Observability</h2>
        
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <ClockIcon className="h-5 w-5 text-purple-600 mr-2" />
              Comprehensive Model Monitoring
            </h3>
            
            <CodeBlock
              code={`# Production model monitoring setup
from schlep_engine import ModelMonitoring, Alerts

monitoring = ModelMonitoring(api_key="your_api_key")

# Configure comprehensive monitoring
monitor_config = monitoring.create_monitor(
    deployment_id=production_deployment.deployment_id,
    monitoring_config={
        "model_performance": {
            "metrics": ["accuracy", "precision", "recall", "f1_score"],
            "reference_dataset": validation_dataset_id,
            "evaluation_frequency": "daily",
            "alert_thresholds": {
                "accuracy_drop": 0.05,      # Alert if accuracy drops >5%
                "drift_score": 0.1,         # Alert if drift score >0.1
                "data_quality_score": 0.8   # Alert if quality drops <0.8
            }
        },
        "data_drift": {
            "methods": ["ks_test", "wasserstein", "psi"],
            "feature_importance_weighted": True,
            "window_size_days": 7,
            "reference_window_days": 30
        },
        "prediction_drift": {
            "methods": ["prediction_distribution", "prediction_stability"],
            "window_size_hours": 24,
            "alert_sensitivity": "medium"
        },
        "operational_metrics": {
            "latency_percentiles": [50, 95, 99],
            "throughput_rps": True,
            "error_rates": True,
            "resource_utilization": True
        },
        "business_metrics": {
            "custom_metrics": [
                {
                    "name": "revenue_impact",
                    "query": "SELECT SUM(revenue) FROM predictions WHERE prediction_date >= NOW() - INTERVAL '1 DAY'",
                    "frequency": "hourly",
                    "threshold_change": 0.1
                }
            ]
        }
    }
)

# Set up intelligent alerting
alert_config = monitoring.configure_alerts(
    monitor_id=monitor_config.monitor_id,
    alert_policies=[
        {
            "name": "critical_performance_degradation",
            "conditions": [
                "accuracy_drop > 0.1 OR error_rate > 0.05",
                "duration > 15 minutes"
            ],
            "severity": "critical",
            "channels": ["pagerduty", "slack_critical"],
            "auto_actions": ["scale_up", "trigger_investigation"]
        },
        {
            "name": "data_drift_warning", 
            "conditions": [
                "drift_score > 0.05 AND drift_score <= 0.1"
            ],
            "severity": "warning",
            "channels": ["slack_ml_team"],
            "auto_actions": ["schedule_retraining_assessment"]
        },
        {
            "name": "business_impact_alert",
            "conditions": [
                "revenue_impact_change < -0.05"
            ],
            "severity": "high",
            "channels": ["slack_business", "email_stakeholders"]
        }
    ]
)

# Create monitoring dashboard
dashboard = monitoring.create_dashboard(
    monitor_id=monitor_config.monitor_id,
    dashboard_config={
        "name": "Sales Forecasting Model Dashboard",
        "sections": [
            {
                "name": "Model Performance",
                "widgets": [
                    {"type": "metric_trend", "metric": "accuracy", "timeframe": "7d"},
                    {"type": "confusion_matrix", "timeframe": "1d"},
                    {"type": "feature_importance", "top_n": 10}
                ]
            },
            {
                "name": "Data Quality",
                "widgets": [
                    {"type": "drift_heatmap", "features": "all"},
                    {"type": "data_quality_score", "timeframe": "7d"},
                    {"type": "missing_values_trend", "timeframe": "7d"}
                ]
            },
            {
                "name": "Operational Metrics",
                "widgets": [
                    {"type": "latency_distribution", "timeframe": "1h"},
                    {"type": "throughput_trend", "timeframe": "24h"},
                    {"type": "error_rate_trend", "timeframe": "24h"}
                ]
            }
        ]
    }
)

print(f"Monitoring dashboard available at: {dashboard.url}")`}
              language="python"
            />
          </div>
        </div>
      </section>

      {/* Phase 4: Automated Retraining */}
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Phase 4: Automated Retraining Workflow</h2>
        
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <CheckCircleIcon className="h-5 w-5 text-green-600 mr-2" />
            Intelligent Retraining Pipeline
          </h3>
          
          <CodeBlock
            code={`# Automated retraining with intelligent triggers
from schlep_engine import AutoRetraining, ModelRegistry

auto_retraining = AutoRetraining(api_key="your_api_key")
model_registry = ModelRegistry(api_key="your_api_key")

# Configure intelligent retraining pipeline
retraining_pipeline = auto_retraining.create_pipeline(
    name="sales_forecast_auto_retrain",
    model_id=production_deployment.model_id,
    retraining_config={
        "triggers": [
            {
                "type": "performance_degradation",
                "threshold": 0.05,  # 5% accuracy drop
                "window_days": 3
            },
            {
                "type": "data_drift",
                "threshold": 0.1,
                "method": "wasserstein",
                "critical_features_only": True
            },
            {
                "type": "scheduled",
                "frequency": "monthly",
                "day_of_month": 1
            },
            {
                "type": "data_volume",
                "min_new_samples": 10000,
                "quality_threshold": 0.8
            }
        ],
        "training_config": {
            "use_latest_data": True,
            "data_window_days": 365,
            "validation_strategy": "time_series_split",
            "hyperparameter_search": "adaptive",
            "early_stopping": True,
            "max_training_time_hours": 6
        },
        "quality_gates": [
            {
                "metric": "accuracy",
                "threshold": 0.85,
                "comparison": "greater_than"
            },
            {
                "metric": "business_metric_correlation",
                "threshold": 0.7,
                "comparison": "greater_than"
            },
            {
                "metric": "fairness_score",
                "threshold": 0.8,
                "comparison": "greater_than"
            }
        ],
        "deployment_config": {
            "strategy": "blue_green",
            "validation_duration_hours": 24,
            "rollback_conditions": [
                "error_rate > 0.01",
                "latency_p95 > 120",
                "business_metric_drop > 0.05"
            ]
        }
    }
)

# Advanced retraining with curriculum learning
curriculum_config = auto_retraining.configure_curriculum(
    pipeline_id=retraining_pipeline.pipeline_id,
    curriculum_config={
        "strategy": "difficulty_based",
        "stages": [
            {
                "name": "foundation",
                "data_criteria": {
                    "confidence_threshold": 0.9,
                    "sample_size": 5000
                },
                "training_config": {
                    "learning_rate": 0.01,
                    "epochs": 50
                }
            },
            {
                "name": "challenging_cases", 
                "data_criteria": {
                    "confidence_threshold": 0.5,
                    "error_prone_samples": True,
                    "sample_size": 10000
                },
                "training_config": {
                    "learning_rate": 0.005,
                    "epochs": 100
                }
            },
            {
                "name": "edge_cases",
                "data_criteria": {
                    "outlier_samples": True,
                    "minority_classes": True,
                    "sample_size": 2000
                },
                "training_config": {
                    "learning_rate": 0.001,
                    "epochs": 200,
                    "regularization": 0.1
                }
            }
        ]
    }
)

# Monitor retraining pipeline
retraining_monitor = auto_retraining.create_monitor(
    pipeline_id=retraining_pipeline.pipeline_id,
    monitoring_config={
        "success_rate_threshold": 0.8,
        "max_consecutive_failures": 3,
        "alert_on_trigger": True,
        "alert_on_failure": True,
        "performance_tracking": {
            "baseline_model": production_deployment.model_id,
            "improvement_threshold": 0.02
        }
    }
)

# Execute retraining with human oversight
def execute_supervised_retraining():
    """Execute retraining with optional human approval for critical decisions"""
    
    # Check if retraining is triggered
    trigger_status = auto_retraining.check_triggers(retraining_pipeline.pipeline_id)
    
    if trigger_status.should_retrain:
        print(f"Retraining triggered by: {trigger_status.trigger_reasons}")
        
        # For high-stakes models, require human approval
        if trigger_status.requires_approval:
            approval = auto_retraining.request_approval(
                pipeline_id=retraining_pipeline.pipeline_id,
                trigger_info=trigger_status,
                approvers=["ml_team_lead@company.com"],
                timeout_hours=24
            )
            
            if not approval.approved:
                print(f"Retraining rejected: {approval.rejection_reason}")
                return
        
        # Execute retraining
        retraining_job = auto_retraining.start_retraining(
            pipeline_id=retraining_pipeline.pipeline_id,
            trigger_info=trigger_status
        )
        
        # Monitor training progress
        while retraining_job.status in ["pending", "running"]:
            time.sleep(60)
            retraining_job = auto_retraining.get_job_status(retraining_job.job_id)
            print(f"Retraining progress: {retraining_job.progress}%")
        
        if retraining_job.status == "completed":
            # Validate new model
            validation_results = auto_retraining.validate_model(
                job_id=retraining_job.job_id,
                validation_config={
                    "holdout_test": True,
                    "business_metric_test": True,
                    "fairness_test": True,
                    "adversarial_test": True
                }
            )
            
            if validation_results.passed:
                # Deploy new model
                deployment_job = auto_retraining.deploy_model(
                    job_id=retraining_job.job_id,
                    deployment_strategy="blue_green"
                )
                print(f"New model deployed: {deployment_job.deployment_id}")
                
                # Update model registry
                model_registry.register_model(
                    model_id=retraining_job.model_id,
                    metadata={
                        "retrain_trigger": trigger_status.trigger_reasons,
                        "performance_improvement": validation_results.improvement,
                        "deployment_timestamp": datetime.now().isoformat()
                    }
                )
            else:
                print(f"Model validation failed: {validation_results.failures}")
        else:
            print(f"Retraining failed: {retraining_job.error_message}")

# Schedule regular execution
import schedule

schedule.every(6).hours.do(execute_supervised_retraining)

# Keep the monitoring running
while True:
    schedule.run_pending()
    time.sleep(3600)  # Check every hour`}
            language="python"
          />
        </div>
      </section>

      {/* Best Practices Summary */}
      <section className="bg-gray-50 rounded-xl p-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">MLOps Best Practices Summary</h2>
        
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">✅ Do's</h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <CheckCircleIcon className="h-4 w-4 text-green-600 mt-0.5 mr-2 flex-shrink-0" />
                Implement comprehensive data quality checks before training
              </li>
              <li className="flex items-start">
                <CheckCircleIcon className="h-4 w-4 text-green-600 mt-0.5 mr-2 flex-shrink-0" />
                Use progressive deployment (shadow → canary → full)
              </li>
              <li className="flex items-start">
                <CheckCircleIcon className="h-4 w-4 text-green-600 mt-0.5 mr-2 flex-shrink-0" />
                Track both technical and business metrics
              </li>
              <li className="flex items-start">
                <CheckCircleIcon className="h-4 w-4 text-green-600 mt-0.5 mr-2 flex-shrink-0" />
                Implement automated rollback mechanisms
              </li>
              <li className="flex items-start">
                <CheckCircleIcon className="h-4 w-4 text-green-600 mt-0.5 mr-2 flex-shrink-0" />
                Maintain model lineage and experiment tracking
              </li>
              <li className="flex items-start">
                <CheckCircleIcon className="h-4 w-4 text-green-600 mt-0.5 mr-2 flex-shrink-0" />
                Use A/B testing for model comparisons
              </li>
              <li className="flex items-start">
                <CheckCircleIcon className="h-4 w-4 text-green-600 mt-0.5 mr-2 flex-shrink-0" />
                Monitor data drift and model performance continuously
              </li>
              <li className="flex items-start">
                <CheckCircleIcon className="h-4 w-4 text-green-600 mt-0.5 mr-2 flex-shrink-0" />
                Implement intelligent retraining triggers
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">❌ Don'ts</h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <ExclamationTriangleIcon className="h-4 w-4 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                Deploy models without proper validation
              </li>
              <li className="flex items-start">
                <ExclamationTriangleIcon className="h-4 w-4 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                Ignore data quality and drift monitoring
              </li>
              <li className="flex items-start">
                <ExclamationTriangleIcon className="h-4 w-4 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                Skip A/B testing for critical production changes
              </li>
              <li className="flex items-start">
                <ExclamationTriangleIcon className="h-4 w-4 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                Use only technical metrics without business context
              </li>
              <li className="flex items-start">
                <ExclamationTriangleIcon className="h-4 w-4 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                Retrain models without proper oversight
              </li>
              <li className="flex items-start">
                <ExclamationTriangleIcon className="h-4 w-4 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                Lack proper rollback and incident response plans
              </li>
              <li className="flex items-start">
                <ExclamationTriangleIcon className="h-4 w-4 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                Forget to monitor model fairness and bias
              </li>
              <li className="flex items-start">
                <ExclamationTriangleIcon className="h-4 w-4 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                Neglect proper experiment documentation
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}