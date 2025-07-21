import CodeBlock from '../../../components/CodeBlock'

export default function EcommerceUseCase() {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8 text-gray-900 dark:text-white">
        E-commerce Analytics Pipeline
      </h1>
      
      <div className="prose prose-lg dark:prose-invert max-w-none">
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
          Build comprehensive e-commerce analytics pipelines for customer behavior analysis, inventory optimization, and personalized recommendations.
        </p>

        <div className="bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-indigo-400 p-6 mb-8">
          <h3 className="text-lg font-semibold text-indigo-800 dark:text-indigo-200 mb-2">
            Complete E-commerce Intelligence
          </h3>
          <ul className="text-indigo-700 dark:text-indigo-300 space-y-1">
            <li>Customer segmentation and lifetime value analysis</li>
            <li>Real-time inventory and demand forecasting</li>
            <li>Product recommendation engines</li>
            <li>Cart abandonment and churn prediction</li>
            <li>Price optimization and competitive analysis</li>
          </ul>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Business Challenge</h2>
        
        <p>
          A mid-size e-commerce retailer processes millions of transactions monthly across multiple channels 
          (web, mobile, marketplace platforms). They need to unify customer data, optimize inventory, 
          reduce cart abandonment, and deliver personalized shopping experiences.
        </p>

        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg my-6">
          <p className="text-red-800 dark:text-red-200">
            <strong>Pain Points:</strong> Fragmented data across platforms, 30% cart abandonment rate, 
            excess inventory costs, and generic product recommendations leading to low conversion rates.
          </p>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Data Integration & Preparation</h2>
        
        <CodeBlock 
          language="python"
          code={`import schlep_engine as se
import pandas as pd
from datetime import datetime, timedelta

# Initialize Schlep Engine client
client = se.Client(api_key="your-api-key")

# Define data sources
data_sources = {
    "orders": "postgresql://db:5432/orders",
    "products": "s3://data-lake/products/",
    "customers": "mongodb://mongo:27017/customers",
    "web_events": "kafka://kafka:9092/web-events",
    "inventory": "api://erp-system/inventory",
    "reviews": "elasticsearch://es:9200/reviews"
}

print(f"Connecting to {len(data_sources)} data sources...")`}
        />

        <h3 className="text-2xl font-semibold mt-8 mb-4">Unified Data Pipeline</h3>
        
        <CodeBlock 
          language="python"
          code={`# Create unified data integration pipeline
integration_pipeline = client.create_pipeline(
    name="ecommerce-data-integration",
    operations=[
        # Extract from multiple sources
        se.operations.extract_data(
            sources=data_sources,
            incremental=True,  # Only fetch new/updated records
            batch_size=10000
        ),
        
        # Customer data unification
        se.operations.unify_customer_records(
            match_fields=["email", "phone", "user_id"],
            merge_strategy="most_complete",
            confidence_threshold=0.9
        ),
        
        # Product catalog normalization
        se.operations.normalize_products(
            standardize_categories=True,
            clean_descriptions=True,
            extract_attributes=True
        ),
        
        # Event stream processing
        se.operations.process_events(
            event_types=["page_view", "add_to_cart", "purchase", "search"],
            sessionize=True,
            session_timeout="30min"
        ),
        
        # Data quality validation
        se.operations.validate_data_quality([
            "order_total > 0",
            "customer_id IS NOT NULL",
            "product_price >= 0",
            "order_date BETWEEN '2020-01-01' AND NOW()"
        ])
    ]
)

# Execute integration
unified_data = integration_pipeline.execute()
print(f"Unified dataset: {len(unified_data)} records across all entities")`}
        />

        <h2 className="text-3xl font-semibold mt-12 mb-6">Customer Analytics</h2>
        
        <h3 className="text-2xl font-semibold mt-8 mb-4">Customer Segmentation</h3>
        
        <CodeBlock 
          language="python"
          code={`# Advanced customer segmentation pipeline
segmentation_pipeline = client.create_pipeline(
    name="customer-segmentation",
    operations=[
        # RFM Analysis (Recency, Frequency, Monetary)
        se.operations.calculate_rfm(
            customer_id="customer_id",
            order_date="order_date",
            order_value="order_total",
            reference_date=datetime.now()
        ),
        
        # Behavioral features
        se.operations.create_behavioral_features([
            "avg_order_value",
            "purchase_frequency",
            "category_preferences",
            "seasonal_patterns",
            "channel_preferences",
            "price_sensitivity"
        ]),
        
        # Advanced clustering
        se.operations.customer_clustering(
            method="hierarchical",
            features=["rfm_score", "behavioral_features"],
            n_clusters="auto",  # Automatically determine optimal clusters
            stability_analysis=True
        ),
        
        # Segment profiling
        se.operations.profile_segments(
            include_demographics=True,
            include_preferences=True,
            statistical_tests=True
        )
    ]
)

# Execute segmentation
segments = segmentation_pipeline.execute(unified_data["customers"])

print("Customer Segments Identified:")
for segment_id, profile in segments.items():
    print(f"Segment {segment_id}: {profile['size']} customers")
    print(f"  - Avg CLV: ${profile['avg_clv']:,.2f}")
    print(f"  - Avg Order Value: ${profile['avg_order_value']:,.2f}")
    print(f"  - Top Category: {profile['top_category']}")
    print(f"  - Churn Risk: {profile['churn_risk']:.1%}\\n")`}
        />

        <h3 className="text-2xl font-semibold mt-8 mb-4">Customer Lifetime Value Prediction</h3>
        
        <CodeBlock 
          language="python"
          code={`# CLV prediction pipeline
clv_pipeline = client.create_ml_pipeline(
    name="clv-prediction",
    operations=[
        # Feature engineering for CLV
        se.operations.create_clv_features([
            "historical_purchases",
            "engagement_metrics",
            "seasonal_behavior",
            "product_affinity",
            "customer_service_interactions"
        ]),
        
        # Time-series features for purchase patterns
        se.operations.time_series_features(
            date_column="order_date",
            value_column="order_total",
            features=["trend", "seasonality", "cyclical_patterns"]
        ),
        
        # Train CLV model
        se.ml.CLVRegressor(
            prediction_period="12months",
            algorithm="xgboost",
            cross_validation=5
        )
    ]
)

# Execute CLV prediction
clv_predictions = clv_pipeline.fit_predict(unified_data["customers"])

print("CLV Prediction Results:")
print(f"Mean predicted CLV: ${clv_predictions['clv'].mean():,.2f}")
print(f"High-value customers (CLV > $1000): {(clv_predictions['clv'] > 1000).sum():,}")
print(f"Model accuracy (MAPE): {clv_predictions['model_accuracy']:.2%}")`}
        />

        <h2 className="text-3xl font-semibold mt-12 mb-6">Product Intelligence</h2>
        
        <h3 className="text-2xl font-semibold mt-8 mb-4">Inventory Optimization</h3>
        
        <CodeBlock 
          language="python"
          code={`# Inventory optimization pipeline
inventory_pipeline = client.create_pipeline(
    name="inventory-optimization",
    operations=[
        # Demand forecasting
        se.operations.forecast_demand(
            product_id="product_id",
            historical_sales="order_history",
            external_factors=["seasonality", "promotions", "holidays"],
            forecast_horizon="8weeks",
            confidence_intervals=True
        ),
        
        # Stock level optimization
        se.operations.optimize_stock_levels(
            demand_forecast="forecasted_demand",
            lead_time="supplier_lead_time",
            holding_cost="holding_cost_per_unit",
            stockout_cost="stockout_penalty",
            service_level=0.95
        ),
        
        # Slow-moving inventory identification
        se.operations.identify_slow_movers(
            velocity_threshold="30days",
            markdown_recommendations=True
        ),
        
        # Reorder point calculation
        se.operations.calculate_reorder_points(
            safety_stock_method="dynamic",
            review_period="weekly"
        )
    ]
)

# Execute inventory optimization
inventory_plan = inventory_pipeline.execute(unified_data["inventory"])

print("Inventory Optimization Results:")
print(f"Total SKUs analyzed: {len(inventory_plan):,}")
print(f"Overstock items: {inventory_plan['overstock'].sum():,}")
print(f"Understock items: {inventory_plan['understock'].sum():,}")
print(f"Potential cost savings: ${inventory_plan['cost_savings'].sum():,.2f}")`}
        />

        <h3 className="text-2xl font-semibold mt-8 mb-4">Product Recommendation Engine</h3>
        
        <CodeBlock 
          language="python"
          code={`# Advanced recommendation system
recommendation_pipeline = client.create_ml_pipeline(
    name="product-recommendations",
    operations=[
        # Collaborative filtering
        se.ml.CollaborativeFiltering(
            user_item_matrix="purchase_matrix",
            method="matrix_factorization",
            factors=100,
            regularization=0.01
        ),
        
        # Content-based filtering
        se.ml.ContentBasedRecommender(
            product_features=["category", "brand", "price_range", "attributes"],
            text_features=["description", "reviews"],
            similarity_metric="cosine"
        ),
        
        # Deep learning recommender
        se.ml.NeuralRecommender(
            embedding_dim=64,
            hidden_layers=[128, 64, 32],
            dropout=0.2,
            batch_size=256
        ),
        
        # Ensemble recommendations
        se.operations.ensemble_recommendations(
            models=["collaborative", "content_based", "neural"],
            weights="auto",  # Learn optimal weights
            diversity_factor=0.2  # Promote recommendation diversity
        ),
        
        # Real-time personalization
        se.operations.personalize_recommendations(
            user_context=["current_session", "time_of_day", "device_type"],
            business_rules=["inventory_available", "margin_thresholds"],
            a_b_testing=True
        )
    ]
)

# Train and deploy recommendation system
rec_system = recommendation_pipeline.fit(unified_data)

# Generate sample recommendations
user_id = "customer_12345"
recommendations = rec_system.recommend(
    user_id=user_id,
    num_recommendations=10,
    include_explanations=True
)

print(f"Recommendations for user {user_id}:")
for i, rec in enumerate(recommendations[:5], 1):
    print(f"{i}. {rec['product_name']} (Score: {rec['score']:.3f})")
    print(f"   Reason: {rec['explanation']}")
    print(f"   Expected CTR: {rec['expected_ctr']:.2%}\\n")`}
        />

        <h2 className="text-3xl font-semibold mt-12 mb-6">Cart Abandonment Prevention</h2>
        
        <CodeBlock 
          language="python"
          code={`# Cart abandonment prediction and intervention
abandonment_pipeline = client.create_ml_pipeline(
    name="cart-abandonment-prevention",
    operations=[
        # Real-time feature extraction
        se.operations.extract_session_features([
            "time_on_site",
            "pages_viewed",
            "cart_value",
            "item_count",
            "price_comparison_behavior",
            "previous_purchases",
            "device_type",
            "traffic_source"
        ]),
        
        # Abandonment risk prediction
        se.ml.AbandonmentPredictor(
            algorithm="gradient_boosting",
            prediction_threshold=0.7,
            real_time=True
        ),
        
        # Intervention strategies
        se.operations.abandonment_interventions([
            se.interventions.DiscountOffer(
                trigger_probability=0.8,
                discount_range=(5, 15),
                personalized=True
            ),
            se.interventions.FreeShippingOffer(
                trigger_probability=0.6,
                min_cart_value=50
            ),
            se.interventions.ScarcityMessage(
                trigger_probability=0.5,
                stock_threshold=10
            ),
            se.interventions.ExitIntentPopup(
                trigger_probability=0.9,
                personalized_message=True
            )
        ]),
        
        # Email recovery campaigns
        se.operations.recovery_email_campaign(
            delay_sequence=["1hour", "24hours", "3days"],
            personalization_level="high",
            a_b_testing=True
        )
    ]
)

# Deploy abandonment prevention system
prevention_system = abandonment_pipeline.deploy(
    environment="production",
    real_time=True,
    monitoring=True
)

print("Cart Abandonment Prevention System Deployed")
print(f"Expected abandonment reduction: 15-25%")
print(f"Estimated revenue recovery: ${prevention_system.revenue_impact:,.2f}/month")`}
        />

        <h2 className="text-3xl font-semibold mt-12 mb-6">Price Optimization</h2>
        
        <CodeBlock 
          language="python"
          code={`# Dynamic pricing optimization
pricing_pipeline = client.create_ml_pipeline(
    name="dynamic-pricing",
    operations=[
        # Price elasticity analysis
        se.operations.calculate_price_elasticity(
            price_column="product_price",
            demand_column="units_sold",
            control_variables=["seasonality", "promotions", "competition"]
        ),
        
        # Competitive analysis
        se.operations.competitive_pricing_analysis(
            competitor_data="competitor_prices",
            market_position="positioning_strategy",
            update_frequency="daily"
        ),
        
        # Demand prediction at different price points
        se.ml.DemandPredictor(
            price_scenarios=["current", "-10%", "-5%", "+5%", "+10%"],
            external_factors=["competitor_prices", "inventory_levels", "seasonality"]
        ),
        
        # Profit maximization
        se.operations.optimize_pricing(
            objective="profit_maximization",
            constraints=["minimum_margin", "competitive_position"],
            price_bounds=(0.7, 1.5),  # 70% to 150% of current price
            category_rules=True
        ),
        
        # A/B testing framework
        se.operations.pricing_ab_test(
            test_duration="2weeks",
            statistical_power=0.8,
            significance_level=0.05
        )
    ]
)

# Execute pricing optimization
pricing_strategy = pricing_pipeline.execute(unified_data["products"])

print("Pricing Optimization Results:")
print(f"Products analyzed: {len(pricing_strategy):,}")
print(f"Average price increase recommended: {pricing_strategy['avg_price_change']:.1%}")
print(f"Estimated profit increase: {pricing_strategy['profit_increase']:.1%}")
print(f"Products requiring price reduction: {pricing_strategy['price_reductions']:,}")`}
        />

        <h2 className="text-3xl font-semibold mt-12 mb-6">Real-time Analytics Dashboard</h2>
        
        <CodeBlock 
          language="python"
          code={`# Real-time analytics and alerting
dashboard_pipeline = client.create_pipeline(
    name="realtime-ecommerce-dashboard",
    operations=[
        # Real-time metrics calculation
        se.operations.calculate_realtime_metrics([
            "conversion_rate",
            "average_order_value",
            "cart_abandonment_rate",
            "inventory_turnover",
            "customer_acquisition_cost",
            "customer_lifetime_value"
        ]),
        
        # Anomaly detection
        se.operations.anomaly_detection(
            metrics=["sales", "traffic", "conversion_rate"],
            detection_method="isolation_forest",
            sensitivity="medium",
            alert_threshold="95th_percentile"
        ),
        
        # Performance alerts
        se.operations.create_alerts([
            se.alerts.ConversionRateAlert(threshold=0.02, period="1hour"),
            se.alerts.InventoryAlert(stock_threshold=10, critical_products=True),
            se.alerts.RevenueAlert(deviation_threshold=0.15, comparison="yesterday"),
            se.alerts.SystemHealthAlert(response_time_threshold="2s")
        ]),
        
        # Automated reporting
        se.operations.generate_reports(
            frequency="daily",
            recipients=["analytics@company.com", "management@company.com"],
            format="pdf",
            include_insights=True
        )
    ]
)

# Deploy real-time dashboard
dashboard = dashboard_pipeline.deploy(
    environment="production",
    update_frequency="1min",
    retention_period="90days"
)

print("Real-time Dashboard Deployed")
print(f"Dashboard URL: {dashboard.url}")
print(f"Metrics tracked: {len(dashboard.metrics)}")
print(f"Alerts configured: {len(dashboard.alerts)}")`}
        />

        <h2 className="text-3xl font-semibold mt-12 mb-6">Expected Business Impact</h2>
        
        <div className="grid md:grid-cols-3 gap-6 my-8">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-3">
              Revenue Growth
            </h3>
            <ul className="text-green-700 dark:text-green-300 space-y-2 text-sm">
              <li>• 15-25% increase in conversion rates</li>
              <li>• 20-30% higher average order value</li>
              <li>• 10-15% reduction in cart abandonment</li>
              <li>• 25% improvement in customer retention</li>
            </ul>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-3">
              Operational Efficiency
            </h3>
            <ul className="text-blue-700 dark:text-blue-300 space-y-2 text-sm">
              <li>• 30% reduction in inventory costs</li>
              <li>• 50% faster data processing</li>
              <li>• 80% reduction in stockouts</li>
              <li>• 60% improvement in forecast accuracy</li>
            </ul>
          </div>
          
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-purple-800 dark:text-purple-200 mb-3">
              Customer Experience
            </h3>
            <ul className="text-purple-700 dark:text-purple-300 space-y-2 text-sm">
              <li>• 40% more relevant recommendations</li>
              <li>• 90% real-time personalization</li>
              <li>• 35% faster page load times</li>
              <li>• 50% reduction in support tickets</li>
            </ul>
          </div>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Implementation Timeline</h2>
        
        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">1</div>
              <div>
                <h4 className="font-semibold">Data Integration & Quality (Week 1-2)</h4>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Connect data sources, unify customer records, establish data quality rules</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">2</div>
              <div>
                <h4 className="font-semibold">Customer Analytics & Segmentation (Week 3-4)</h4>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Implement customer segmentation, CLV prediction, and behavioral analysis</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">3</div>
              <div>
                <h4 className="font-semibold">Product Intelligence & Recommendations (Week 5-6)</h4>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Deploy recommendation engine, inventory optimization, and demand forecasting</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">4</div>
              <div>
                <h4 className="font-semibold">Optimization & Monitoring (Week 7-8)</h4>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Launch cart abandonment prevention, price optimization, and real-time dashboard</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg mt-12">
          <h3 className="text-lg font-semibold mb-4">Next Steps & Related Resources</h3>
          <ul className="space-y-2">
            <li><a href="/integrations/snowflake" className="text-blue-600 dark:text-blue-400 hover:underline">→ Snowflake Data Warehouse Integration</a></li>
            <li><a href="/use-cases/realtime" className="text-blue-600 dark:text-blue-400 hover:underline">→ Real-time Processing Use Case</a></li>
            <li><a href="/integrations/dbt" className="text-blue-600 dark:text-blue-400 hover:underline">→ dbt Data Transformation</a></li>
            <li><a href="/use-cases/quality-monitoring" className="text-blue-600 dark:text-blue-400 hover:underline">→ Data Quality Monitoring</a></li>
          </ul>
        </div>
      </div>
    </div>
  )
}