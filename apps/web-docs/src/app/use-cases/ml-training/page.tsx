import CodeBlock from '../../../components/CodeBlock'

export default function MLTrainingUseCase() {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8 text-gray-900 dark:text-white">
        ML Model Training Pipeline
      </h1>
      
      <div className="prose prose-lg dark:prose-invert max-w-none">
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
          Build end-to-end machine learning training pipelines with automated data preprocessing, feature engineering, and model validation.
        </p>

        <div className="bg-purple-50 dark:bg-purple-900/20 border-l-4 border-purple-400 p-6 mb-8">
          <h3 className="text-lg font-semibold text-purple-800 dark:text-purple-200 mb-2">
            Complete ML Workflow
          </h3>
          <ul className="text-purple-700 dark:text-purple-300 space-y-1">
            <li>Automated data cleaning and validation</li>
            <li>Feature engineering and selection</li>
            <li>Model training with hyperparameter tuning</li>
            <li>Performance evaluation and model comparison</li>
            <li>Production-ready model deployment</li>
          </ul>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Business Problem</h2>
        
        <p>
          A fintech company needs to build a credit risk model to predict loan defaults. 
          They have historical loan data with customer demographics, financial history, and loan outcomes, 
          but the data requires significant preprocessing and feature engineering before training.
        </p>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg my-6">
          <p className="text-yellow-800 dark:text-yellow-200">
            <strong>Challenge:</strong> Raw financial data is messy, contains missing values, requires domain-specific transformations, 
            and needs careful handling to avoid data leakage in time-series scenarios.
          </p>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Solution Architecture</h2>
        
        <CodeBlock 
          language="python"
          code={`import schlep_engine as se
import pandas as pd
from datetime import datetime

# Initialize Schlep Engine client
client = se.Client(api_key="your-api-key")

# Load raw data
raw_data = pd.read_csv("loan_applications.csv")
print(f"Raw data shape: {raw_data.shape}")
print(f"Columns: {list(raw_data.columns)}")`}
        />

        <h3 className="text-2xl font-semibold mt-8 mb-4">Step 1: Data Quality Assessment</h3>
        
        <CodeBlock 
          language="python"
          code={`# Create data quality pipeline
quality_pipeline = client.create_pipeline(
    name="data-quality-assessment",
    operations=[
        se.operations.profile_data(),
        se.operations.detect_anomalies(),
        se.operations.identify_missing_patterns(),
        se.operations.check_data_drift()
    ]
)

# Execute quality assessment
quality_report = quality_pipeline.execute(raw_data)

print("Data Quality Summary:")
print(f"Missing values: {quality_report['missing_percentage']}%")
print(f"Anomalies detected: {quality_report['anomaly_count']}")
print(f"Data drift score: {quality_report['drift_score']}")`}
        />

        <h3 className="text-2xl font-semibold mt-8 mb-4">Step 2: Data Preprocessing</h3>
        
        <CodeBlock 
          language="python"
          code={`# Create comprehensive preprocessing pipeline
preprocessing_pipeline = client.create_pipeline(
    name="loan-preprocessing",
    operations=[
        # Data cleaning
        se.operations.handle_missing_values(
            strategy="smart",  # Uses domain knowledge
            numeric_method="median",
            categorical_method="mode"
        ),
        
        # Outlier handling
        se.operations.handle_outliers(
            method="iqr",
            columns=["income", "loan_amount", "debt_to_income"],
            action="cap"  # Cap at 1.5*IQR instead of removing
        ),
        
        # Data type corrections
        se.operations.fix_data_types(
            date_columns=["application_date", "employment_start_date"],
            categorical_columns=["employment_type", "loan_purpose"],
            boolean_columns=["has_cosigner", "owns_property"]
        ),
        
        # Remove duplicates with sophisticated matching
        se.operations.deduplicate(
            method="fuzzy",
            match_columns=["ssn", "email", "phone"],
            similarity_threshold=0.95
        )
    ]
)

# Execute preprocessing
clean_data = preprocessing_pipeline.execute(raw_data)
print(f"Clean data shape: {clean_data.shape}")
print(f"Data quality improvement: {preprocessing_pipeline.get_quality_improvement()}")`}
        />

        <h3 className="text-2xl font-semibold mt-8 mb-4">Step 3: Feature Engineering</h3>
        
        <CodeBlock 
          language="python"
          code={`# Advanced feature engineering pipeline
feature_pipeline = client.create_pipeline(
    name="credit-risk-features",
    operations=[
        # Temporal features
        se.operations.create_time_features(
            date_column="application_date",
            features=["month", "quarter", "day_of_week", "is_weekend"]
        ),
        
        # Financial ratios and derived features
        se.operations.create_financial_ratios([
            ("debt_to_income", ["total_debt", "monthly_income"]),
            ("loan_to_income", ["loan_amount", "annual_income"]),
            ("payment_to_income", ["monthly_payment", "monthly_income"])
        ]),
        
        # Employment stability features
        se.operations.calculate_tenure(
            start_date="employment_start_date",
            end_date="application_date",
            output_column="employment_months"
        ),
        
        # Categorical encoding with target encoding for high cardinality
        se.operations.encode_categorical(
            method="target",
            columns=["occupation", "employer"],
            target_column="default",
            cv_folds=5  # Prevent overfitting
        ),
        
        # Interaction features
        se.operations.create_interactions([
            ("age", "income"),
            ("loan_amount", "credit_score"),
            ("employment_months", "debt_to_income")
        ]),
        
        # Binning for non-linear relationships
        se.operations.create_bins(
            columns=["credit_score", "age", "income"],
            method="quantile",
            n_bins=10
        )
    ]
)

# Execute feature engineering
featured_data = feature_pipeline.execute(clean_data)
print(f"Features created: {featured_data.shape[1] - clean_data.shape[1]}")
print(f"Final dataset shape: {featured_data.shape}")`}
        />

        <h3 className="text-2xl font-semibold mt-8 mb-4">Step 4: Feature Selection</h3>
        
        <CodeBlock 
          language="python"
          code={`# Intelligent feature selection
selection_pipeline = client.create_pipeline(
    name="feature-selection",
    operations=[
        # Remove highly correlated features
        se.operations.remove_correlated_features(threshold=0.95),
        
        # Statistical feature selection
        se.operations.select_features(
            method="mutual_info",
            k_best=50,
            target_column="default"
        ),
        
        # Stability analysis
        se.operations.feature_stability_analysis(
            time_column="application_date",
            min_stability_score=0.7
        ),
        
        # Business rule validation
        se.operations.validate_features([
            "credit_score >= 300",  # Valid credit score range
            "age >= 18",           # Legal age requirement
            "loan_amount > 0"      # Positive loan amount
        ])
    ]
)

# Execute feature selection
selected_data = selection_pipeline.execute(featured_data)
final_features = selection_pipeline.get_selected_features()
print(f"Selected features: {len(final_features)}")
print(f"Top 10 features by importance: {final_features[:10]}")`}
        />

        <h3 className="text-2xl font-semibold mt-8 mb-4">Step 5: Time-Aware Data Splitting</h3>
        
        <CodeBlock 
          language="python"
          code={`# Time-aware train/validation/test split to prevent data leakage
split_pipeline = client.create_pipeline(
    name="time-aware-split",
    operations=[
        se.operations.time_split(
            time_column="application_date",
            train_end_date="2022-12-31",
            val_start_date="2023-01-01",
            val_end_date="2023-06-30",
            test_start_date="2023-07-01"
        ),
        
        # Ensure balanced splits
        se.operations.stratified_balance(
            target_column="default",
            min_class_ratio=0.1
        )
    ]
)

# Execute splitting
train_data, val_data, test_data = split_pipeline.execute(selected_data)

print(f"Train set: {train_data.shape} ({train_data['default'].mean():.3f} default rate)")
print(f"Validation set: {val_data.shape} ({val_data['default'].mean():.3f} default rate)")
print(f"Test set: {test_data.shape} ({test_data['default'].mean():.3f} default rate)")`}
        />

        <h2 className="text-3xl font-semibold mt-12 mb-6">Model Training & Evaluation</h2>
        
        <h3 className="text-2xl font-semibold mt-8 mb-4">Automated Model Training</h3>
        
        <CodeBlock 
          language="python"
          code={`# Create model training pipeline with multiple algorithms
training_pipeline = client.create_ml_pipeline(
    name="credit-risk-training",
    algorithms=[
        se.ml.XGBClassifier(
            hyperparameters={
                "max_depth": [3, 5, 7],
                "learning_rate": [0.01, 0.1, 0.2],
                "n_estimators": [100, 200, 500],
                "subsample": [0.8, 0.9, 1.0]
            }
        ),
        se.ml.LightGBMClassifier(
            hyperparameters={
                "num_leaves": [31, 50, 100],
                "learning_rate": [0.01, 0.1, 0.2],
                "feature_fraction": [0.8, 0.9, 1.0]
            }
        ),
        se.ml.RandomForestClassifier(
            hyperparameters={
                "n_estimators": [100, 200, 500],
                "max_depth": [10, 20, None],
                "min_samples_split": [2, 5, 10]
            }
        )
    ],
    cross_validation=5,
    scoring_metrics=["roc_auc", "precision", "recall", "f1"],
    hyperparameter_optimization="bayesian"
)

# Train all models
results = training_pipeline.fit(
    X_train=train_data.drop("default", axis=1),
    y_train=train_data["default"],
    X_val=val_data.drop("default", axis=1),
    y_val=val_data["default"]
)

print("Model Performance Summary:")
for model_name, metrics in results.items():
    print(f"{model_name}: AUC={metrics['roc_auc']:.4f}, Precision={metrics['precision']:.4f}")
    
best_model = training_pipeline.get_best_model()
print(f"\\nBest model: {best_model.name} with AUC: {best_model.score:.4f}")`}
        />

        <h3 className="text-2xl font-semibold mt-8 mb-4">Model Interpretation</h3>
        
        <CodeBlock 
          language="python"
          code={`# Generate model interpretability reports
interpretation_pipeline = client.create_pipeline(
    name="model-interpretation",
    operations=[
        se.operations.feature_importance(
            method="shap",
            top_features=20
        ),
        se.operations.partial_dependence(
            features=["credit_score", "debt_to_income", "loan_amount"],
            interaction_features=[("credit_score", "loan_amount")]
        ),
        se.operations.model_explanation(
            explanation_type="global",
            include_interactions=True
        )
    ]
)

# Generate explanations
explanations = interpretation_pipeline.execute(best_model, test_data)

print("Top 10 Most Important Features:")
for feature, importance in explanations['feature_importance'].head(10).items():
    print(f"{feature}: {importance:.4f}")
    
# Generate individual prediction explanations
sample_prediction = best_model.explain_prediction(test_data.iloc[0])
print(f"\\nSample prediction explanation: {sample_prediction}")`}
        />

        <h2 className="text-3xl font-semibold mt-12 mb-6">Model Validation & Testing</h2>
        
        <CodeBlock 
          language="python"
          code={`# Comprehensive model validation
validation_pipeline = client.create_pipeline(
    name="model-validation",
    operations=[
        # Performance on test set
        se.operations.evaluate_model(
            metrics=["roc_auc", "precision", "recall", "f1", "brier_score"]
        ),
        
        # Fairness analysis
        se.operations.fairness_analysis(
            protected_attributes=["gender", "race", "age_group"],
            fairness_metrics=["equalized_odds", "demographic_parity"]
        ),
        
        # Stability testing
        se.operations.temporal_stability(
            time_column="application_date",
            time_windows=["1M", "3M", "6M"]
        ),
        
        # Robustness testing
        se.operations.robustness_test(
            perturbation_methods=["noise", "outliers", "missing_values"],
            perturbation_levels=[0.1, 0.2, 0.3]
        )
    ]
)

# Execute validation
validation_results = validation_pipeline.execute(best_model, test_data)

print("Final Model Performance:")
print(f"Test AUC: {validation_results['roc_auc']:.4f}")
print(f"Test Precision: {validation_results['precision']:.4f}")
print(f"Test Recall: {validation_results['recall']:.4f}")
print(f"Fairness Score: {validation_results['fairness_score']:.4f}")
print(f"Stability Score: {validation_results['stability_score']:.4f}")`}
        />

        <h2 className="text-3xl font-semibold mt-12 mb-6">Production Deployment</h2>
        
        <CodeBlock 
          language="python"
          code={`# Prepare model for production
deployment_pipeline = client.create_pipeline(
    name="production-deployment",
    operations=[
        se.operations.model_serialization(format="onnx"),
        se.operations.create_inference_pipeline(),
        se.operations.add_monitoring_hooks(),
        se.operations.generate_model_card()
    ]
)

# Deploy to production
production_model = deployment_pipeline.deploy(
    model=best_model,
    environment="production",
    auto_scaling=True,
    monitoring_enabled=True,
    a_b_testing=True  # Enable gradual rollout
)

print(f"Model deployed successfully!")
print(f"Endpoint URL: {production_model.endpoint_url}")
print(f"Model version: {production_model.version}")

# Test production endpoint
test_prediction = production_model.predict({
    "credit_score": 720,
    "annual_income": 65000,
    "loan_amount": 25000,
    "debt_to_income": 0.35,
    "employment_months": 36
})

print(f"Test prediction: {test_prediction}")`}
        />

        <h2 className="text-3xl font-semibold mt-12 mb-6">Expected Outcomes</h2>
        
        <div className="grid md:grid-cols-2 gap-6 my-8">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-3">
              Business Impact
            </h3>
            <ul className="text-green-700 dark:text-green-300 space-y-2 text-sm">
              <li>• 15-25% reduction in default rates</li>
              <li>• $2-5M annual savings from better risk assessment</li>
              <li>• 40% faster loan approval process</li>
              <li>• Improved regulatory compliance</li>
            </ul>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-3">
              Technical Metrics
            </h3>
            <ul className="text-blue-700 dark:text-blue-300 space-y-2 text-sm">
              <li>• AUC Score: 0.85-0.90</li>
              <li>• 90% reduction in manual data prep time</li>
              <li>• 99.9% model uptime</li>
              <li>• Sub-second prediction latency</li>
            </ul>
          </div>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Best Practices</h2>
        
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-6 mb-8">
          <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-4">
            Key Recommendations
          </h3>
          <ul className="text-yellow-700 dark:text-yellow-300 space-y-2">
            <li><strong>Time-aware validation:</strong> Always use time-based splits for financial data</li>
            <li><strong>Feature stability:</strong> Monitor feature distributions in production</li>
            <li><strong>Fairness monitoring:</strong> Regular bias detection and mitigation</li>
            <li><strong>Model governance:</strong> Maintain detailed model cards and lineage</li>
            <li><strong>Continuous learning:</strong> Implement feedback loops for model improvement</li>
          </ul>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg mt-12">
          <h3 className="text-lg font-semibold mb-4">Related Resources</h3>
          <ul className="space-y-2">
            <li><a href="/integrations/aws-sagemaker" className="text-blue-600 dark:text-blue-400 hover:underline">→ Deploy on AWS SageMaker</a></li>
            <li><a href="/use-cases/quality-monitoring" className="text-blue-600 dark:text-blue-400 hover:underline">→ Data Quality Monitoring</a></li>
            <li><a href="/use-cases/fintech" className="text-blue-600 dark:text-blue-400 hover:underline">→ Financial Services Use Cases</a></li>
            <li><a href="/advanced/model-monitoring" className="text-blue-600 dark:text-blue-400 hover:underline">→ Production Model Monitoring</a></li>
          </ul>
        </div>
      </div>
    </div>
  )
}