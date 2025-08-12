'use client'

import React from 'react'
import Link from 'next/link'
import { TrendingUp, Zap, Activity, Clock, CheckCircle, AlertTriangle, BarChart3, ShoppingCart, Users } from 'lucide-react'

export default function EcommerceScalingPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-12">
          <Link href="/docs/api-reference" className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-4 inline-block">
            ← Back to API Reference
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">E-commerce Seasonal Scaling</h1>
          <p className="text-xl text-gray-600">
            Auto-scaling recommendation APIs designed for e-commerce traffic spikes, seasonal events, and high-availability requirements during peak shopping periods.
          </p>
        </div>

        {/* Overview */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Overview</h2>
          <p className="text-gray-600 mb-6">
            E-commerce businesses experience extreme traffic variations during seasonal events like Black Friday, Cyber Monday, and holiday shopping. 
            Our seasonal scaling APIs provide predictive auto-scaling, real-time load balancing, and intelligent resource allocation to handle 
            traffic spikes of 10-50x normal levels while maintaining sub-200ms response times.
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">Seasonal Events Supported</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <ul className="list-disc list-inside text-blue-800 space-y-2">
                <li>Black Friday (up to 50x traffic scaling)</li>
                <li>Cyber Monday (up to 35x traffic scaling)</li>
                <li>Prime Day and flash sales (up to 25x traffic scaling)</li>
                <li>Holiday shopping periods (2-5x sustained scaling)</li>
              </ul>
              <ul className="list-disc list-inside text-blue-800 space-y-2">
                <li>Product launches and drops (up to 20x traffic scaling)</li>
                <li>Influencer campaigns and viral events</li>
                <li>Geographic market expansions</li>
                <li>Custom seasonal events and promotions</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Predictive Scaling Configuration */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Predictive Scaling Configuration</h2>
          
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <div className="mb-4">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 mr-2">
                POST
              </span>
              <code className="text-lg font-mono text-gray-800">/v1/ecommerce/scaling/configure</code>
            </div>
            
            <p className="text-gray-600 mb-4">
              Configure predictive scaling policies based on historical traffic patterns, seasonal events, and business forecasts. 
              The system will automatically pre-scale your recommendation infrastructure before traffic spikes occur.
            </p>
            
            <h4 className="font-semibold text-gray-900 mb-2">Request Body</h4>
            <div className="bg-gray-900 rounded p-4 mb-4">
              <pre className="text-green-400 text-sm overflow-x-auto"><code>{`{
  "scaling_policy": {
    "policy_name": "holiday_2024_scaling",
    "predictive_enabled": true,
    "traffic_forecast_days": 14,
    "scale_up_threshold": "70%",
    "scale_down_threshold": "30%",
    "min_instances": 10,
    "max_instances": 1000,
    "target_response_time": "150ms",
    "geographic_distribution": true
  },
  "seasonal_patterns": {
    "black_friday": {
      "date": "2024-11-29",
      "expected_multiplier": 45,
      "duration_hours": 24,
      "pre_scale_hours": 6,
      "ramp_down_hours": 12
    },
    "cyber_monday": {
      "date": "2024-12-02", 
      "expected_multiplier": 32,
      "duration_hours": 18,
      "pre_scale_hours": 4,
      "ramp_down_hours": 8
    },
    "christmas_week": {
      "date_range": ["2024-12-20", "2024-12-24"],
      "expected_multiplier": 8,
      "sustained_load": true,
      "daily_peak_hours": ["10:00", "20:00"]
    },
    "new_year_sale": {
      "date": "2025-01-01",
      "expected_multiplier": 15,
      "duration_hours": 48,
      "pre_scale_hours": 8
    }
  },
  "business_context": {
    "industry": "fashion_retail",
    "primary_markets": ["US", "CA", "UK"],
    "average_daily_traffic": 250000,
    "conversion_goals": {
      "target_conversion_rate": 0.089,
      "max_acceptable_latency": "200ms",
      "availability_target": "99.99%"
    }
  },
  "recommendation_priorities": {
    "personalization_weight": 0.7,
    "trending_weight": 0.2,
    "inventory_optimization": 0.1,
    "cold_start_handling": true,
    "mobile_optimization": true
  }
}`}</code></pre>
            </div>
            
            <h4 className="font-semibold text-gray-900 mb-2">Response</h4>
            <div className="bg-gray-900 rounded p-4">
              <pre className="text-green-400 text-sm overflow-x-auto"><code>{`{
  "policy_id": "scaling_policy_789",
  "status": "configured",
  "validation_results": {
    "config_valid": true,
    "estimated_peak_instances": 847,
    "estimated_monthly_cost": 45600,
    "cost_vs_manual_scaling": "67% savings"
  },
  "scaling_schedule": [
    {
      "event": "black_friday_2024",
      "pre_scale_start": "2024-11-29T00:00:00Z",
      "peak_period": "2024-11-29T06:00:00Z to 2024-11-30T06:00:00Z",
      "estimated_instances": "450-850",
      "preparation_checklist": [
        "cdn_cache_warming",
        "database_read_replicas",
        "monitoring_alerts_active"
      ]
    },
    {
      "event": "cyber_monday_2024", 
      "pre_scale_start": "2024-12-02T04:00:00Z",
      "peak_period": "2024-12-02T08:00:00Z to 2024-12-03T02:00:00Z",
      "estimated_instances": "320-650",
      "performance_target": "maintain_150ms_p95"
    }
  ],
  "monitoring_dashboard": "https://dashboard.schlep-engine.com/scaling/scaling_policy_789",
  "alert_webhooks": [
    "https://your-alerts.com/scaling-events",
    "https://your-alerts.com/performance-degradation"
  ]
}`}</code></pre>
            </div>
          </div>
        </section>

        {/* Real-time Scaling Operations */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Real-time Scaling Operations</h2>
          
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <div className="mb-4">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 mr-2">
                GET
              </span>
              <code className="text-lg font-mono text-gray-800">/v1/ecommerce/scaling/status</code>
            </div>
            
            <p className="text-gray-600 mb-4">
              Monitor real-time scaling status, performance metrics, and resource utilization during traffic events. 
              Provides detailed insights into recommendation latency, throughput, and system health.
            </p>
            
            <h4 className="font-semibold text-gray-900 mb-2">Response</h4>
            <div className="bg-gray-900 rounded p-4">
              <pre className="text-green-400 text-sm overflow-x-auto"><code>{`{
  "scaling_status": {
    "current_event": "black_friday_2024",
    "event_phase": "peak_traffic",
    "scaling_state": "active",
    "current_instances": 623,
    "target_instances": 650,
    "scaling_direction": "up"
  },
  "performance_metrics": {
    "current_load": "847%",
    "requests_per_second": 47234,
    "recommendations_per_second": 31567,
    "average_response_time": "127ms",
    "p95_response_time": "189ms",
    "p99_response_time": "267ms",
    "error_rate": "0.02%",
    "cache_hit_rate": "94.7%"
  },
  "traffic_analysis": {
    "current_traffic_multiplier": 42.3,
    "geographic_distribution": {
      "US_East": "35%",
      "US_West": "28%", 
      "Canada": "15%",
      "UK": "12%",
      "Other": "10%"
    },
    "device_breakdown": {
      "mobile": "67%",
      "desktop": "28%",
      "tablet": "5%"
    },
    "traffic_sources": {
      "direct": "34%",
      "social_media": "28%",
      "search": "21%",
      "email": "12%",
      "paid_ads": "5%"
    }
  },
  "recommendation_performance": {
    "personalized_recommendations": {
      "requests_per_second": 23890,
      "average_latency": "98ms",
      "cache_efficiency": "89%",
      "click_through_rate": "8.7%"
    },
    "cold_start_recommendations": {
      "requests_per_second": 7677,
      "average_latency": "134ms",
      "accuracy_score": 0.85,
      "conversion_rate": "3.2%"
    }
  },
  "resource_utilization": {
    "cpu_usage": "73%",
    "memory_usage": "68%",
    "network_throughput": "2.1GB/s",
    "database_connections": "847/1200",
    "cache_memory_usage": "89%"
  },
  "scaling_events": [
    {
      "timestamp": "2024-11-29T14:23:15Z",
      "event": "scale_up",
      "instances_added": 47,
      "reason": "response_time_threshold_exceeded",
      "completion_time": "2m 34s"
    },
    {
      "timestamp": "2024-11-29T13:45:32Z", 
      "event": "pre_scale",
      "instances_added": 125,
      "reason": "predictive_traffic_spike",
      "completion_time": "4m 12s"
    }
  ],
  "health_checks": {
    "api_health": "healthy",
    "database_health": "healthy",
    "cache_health": "healthy",
    "cdn_health": "healthy",
    "monitoring_active": true
  },
  "next_scaling_prediction": {
    "estimated_time": "2024-11-29T16:30:00Z",
    "predicted_action": "scale_up",
    "estimated_instances": 720,
    "confidence": 0.94
  }
}`}</code></pre>
            </div>
          </div>
        </section>

        {/* Load Testing & Validation */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Pre-Event Load Testing</h2>
          
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <div className="mb-4">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 mr-2">
                POST
              </span>
              <code className="text-lg font-mono text-gray-800">/v1/ecommerce/scaling/load-test</code>
            </div>
            
            <p className="text-gray-600 mb-4">
              Validate your scaling configuration with synthetic load tests that simulate expected traffic patterns. 
              Essential for testing before major seasonal events to identify bottlenecks and optimize configuration.
            </p>
            
            <h4 className="font-semibold text-gray-900 mb-2">Request Body</h4>
            <div className="bg-gray-900 rounded p-4 mb-4">
              <pre className="text-green-400 text-sm overflow-x-auto"><code>{`{
  "test_configuration": {
    "test_name": "black_friday_dress_rehearsal",
    "target_event": "black_friday_2024",
    "simulation_duration": "2_hours",
    "traffic_pattern": "black_friday_historical",
    "peak_multiplier": 45,
    "ramp_up_minutes": 30,
    "sustained_peak_minutes": 60,
    "ramp_down_minutes": 30
  },
  "traffic_simulation": {
    "concurrent_users": 125000,
    "requests_per_user_per_minute": 8,
    "recommendation_requests_ratio": 0.75,
    "geographic_distribution": {
      "US_East": 0.35,
      "US_West": 0.28,
      "Canada": 0.15,
      "UK": 0.12,
      "Other": 0.10
    },
    "device_simulation": {
      "mobile": 0.67,
      "desktop": 0.28,
      "tablet": 0.05
    },
    "user_behavior": {
      "new_users_percentage": 0.45,
      "returning_users_percentage": 0.55,
      "average_session_duration": "12_minutes",
      "pages_per_session": 7
    }
  },
  "success_criteria": {
    "max_response_time_p95": "200ms",
    "max_error_rate": "0.1%",
    "min_availability": "99.9%",
    "target_conversion_rate": "8.5%",
    "recommendation_accuracy": 0.85
  },
  "monitoring_focus": [
    "response_time_distribution",
    "error_patterns",
    "scaling_behavior",
    "resource_bottlenecks",
    "cache_performance"
  ]
}`}</code></pre>
            </div>
            
            <h4 className="font-semibold text-gray-900 mb-2">Response</h4>
            <div className="bg-gray-900 rounded p-4">
              <pre className="text-green-400 text-sm overflow-x-auto"><code>{`{
  "load_test_id": "loadtest_456",
  "test_status": "completed",
  "test_duration": "2h 15m",
  "summary_results": {
    "overall_success": true,
    "performance_grade": "A",
    "scaling_effectiveness": "excellent",
    "bottlenecks_identified": 2
  },
  "performance_results": {
    "peak_concurrent_users": 124567,
    "total_requests": 15678234,
    "average_response_time": "134ms",
    "p95_response_time": "187ms",
    "p99_response_time": "298ms",
    "error_rate": "0.04%",
    "availability": "99.97%"
  },
  "scaling_analysis": {
    "instances_at_peak": 634,
    "scaling_events": 23,
    "average_scale_up_time": "2m 18s",
    "average_scale_down_time": "4m 45s",
    "scaling_efficiency": "92%",
    "predictive_accuracy": "89%"
  },
  "recommendation_performance": {
    "recommendations_served": 11758675,
    "average_recommendation_latency": "98ms",
    "recommendation_accuracy": 0.87,
    "cache_hit_rate": "91.3%",
    "personalization_rate": "78%"
  },
  "bottlenecks_identified": [
    {
      "component": "database_connections",
      "severity": "medium",
      "description": "Connection pool reached 95% utilization at peak",
      "recommendation": "Increase max_connections from 1200 to 1800",
      "estimated_improvement": "15% response time reduction"
    },
    {
      "component": "cdn_cache_warming",
      "severity": "low", 
      "description": "Cache miss rate spiked to 12% during rapid ramp-up",
      "recommendation": "Implement predictive cache warming 2 hours before event",
      "estimated_improvement": "8% latency reduction"
    }
  ],
  "resource_utilization": {
    "peak_cpu": "78%",
    "peak_memory": "71%",
    "peak_network": "2.4GB/s",
    "peak_storage_iops": "45000"
  },
  "recommendations": [
    {
      "priority": "high",
      "action": "increase_database_connection_pool",
      "details": "Scale database connections to handle 1800 concurrent connections",
      "implementation_time": "30_minutes"
    },
    {
      "priority": "medium",
      "action": "optimize_cache_warming",
      "details": "Implement predictive cache warming based on historical access patterns",
      "implementation_time": "2_hours"
    },
    {
      "priority": "low",
      "action": "fine_tune_scaling_thresholds",
      "details": "Adjust scale-up threshold from 70% to 65% for faster response",
      "implementation_time": "15_minutes"
    }
  ],
  "cost_analysis": {
    "test_infrastructure_cost": 2840,
    "projected_event_cost": 14600,
    "cost_vs_manual_scaling": "62% savings",
    "roi_projection": "847% over holiday season"
  },
  "next_steps": [
    "Review and implement recommended optimizations",
    "Schedule final validation test 48 hours before event",
    "Configure monitoring alerts and dashboards",
    "Prepare incident response procedures"
  ]
}`}</code></pre>
            </div>
          </div>
        </section>

        {/* Emergency Scaling Controls */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Emergency Scaling Controls</h2>
          
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div className="bg-red-50 rounded-lg p-6">
              <AlertTriangle className="h-8 w-8 text-red-600 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Circuit Breaker Protection</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• Automatic traffic throttling during overload</li>
                <li>• Graceful degradation to essential features</li>
                <li>• Queue management for high-value customers</li>
                <li>• Real-time capacity management</li>
              </ul>
            </div>
            
            <div className="bg-orange-50 rounded-lg p-6">
              <Zap className="h-8 w-8 text-orange-600 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Emergency Scale Override</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• Manual scaling overrides via API</li>
                <li>• Instant maximum capacity deployment</li>
                <li>• Geographic traffic redistribution</li>
                <li>• Priority customer routing</li>
              </ul>
            </div>
          </div>

          <div className="bg-gray-900 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Emergency Scaling API</h3>
            <pre className="text-green-400 text-sm overflow-x-auto"><code>{`# Emergency maximum scaling activation
curl -X POST https://api.schlep-engine.com/v1/ecommerce/scaling/emergency \\
  -H "Authorization: Bearer your-emergency-api-key" \\
  -d '{
    "action": "maximum_scale",
    "reason": "unexpected_viral_traffic",
    "duration": "2_hours",
    "priority_mode": "high_value_customers",
    "notifications": [
      "ops-team@company.com",
      "cto@company.com"
    ]
  }'

# Response
{
  "emergency_activation_id": "emergency_789",
  "status": "activated",
  "instances_deployed": 950,
  "estimated_capacity": "50x_normal",
  "activation_time": "3m 45s",
  "estimated_hourly_cost": 1247,
  "monitoring_dashboard": "https://emergency.schlep-engine.com/emergency_789"
}

# Graceful degradation activation
curl -X POST https://api.schlep-engine.com/v1/ecommerce/scaling/degradation \\
  -H "Authorization: Bearer your-api-key" \\
  -d '{
    "degradation_level": "preserve_checkout",
    "disabled_features": [
      "advanced_personalization",
      "cross_sell_recommendations",
      "recently_viewed_complex"
    ],
    "preserved_features": [
      "basic_recommendations", 
      "checkout_process",
      "search_functionality"
    ]
  }'`}</code></pre>
          </div>
        </section>

        {/* Performance Analytics */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Post-Event Analytics</h2>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <div className="flex items-start space-x-3">
              <BarChart3 className="h-6 w-6 text-blue-600 mt-1 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold text-blue-800 mb-2">Comprehensive Event Analysis</h3>
                <p className="text-blue-700">
                  After each seasonal event, receive detailed analytics on scaling performance, cost optimization opportunities, 
                  and recommendations for future events based on actual traffic patterns and system behavior.
                </p>
              </div>
            </div>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-gray-50 rounded-lg p-6 text-center">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">99.99%</h3>
              <p className="text-gray-600">Peak Event Uptime</p>
              <p className="text-sm text-gray-500 mt-2">Average across all clients</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-6 text-center">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">127ms</h3>
              <p className="text-gray-600">Average Response Time</p>
              <p className="text-sm text-gray-500 mt-2">During 45x traffic spikes</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-6 text-center">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">67%</h3>
              <p className="text-gray-600">Cost Savings</p>
              <p className="text-sm text-gray-500 mt-2">vs manual scaling</p>
            </div>
          </div>
        </section>

        {/* Best Practices */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Seasonal Scaling Best Practices</h2>
          
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-green-800 mb-3">Preparation Timeline</h3>
              <ul className="list-disc list-inside text-green-700 space-y-2">
                <li>Configure scaling policies 4-6 weeks before major events</li>
                <li>Run load tests 2-3 weeks before to identify bottlenecks</li>
                <li>Perform final validation tests 48-72 hours before events</li>
                <li>Enable monitoring and alerts 24 hours before events</li>
              </ul>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-800 mb-3">Configuration Recommendations</h3>
              <ul className="list-disc list-inside text-blue-700 space-y-2">
                <li>Set target response times conservatively (under 150ms for recommendations)</li>
                <li>Configure pre-scaling 2-6 hours before predicted traffic spikes</li>
                <li>Enable geographic distribution for global traffic patterns</li>
                <li>Implement gradual scale-down to avoid premature resource reduction</li>
              </ul>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-yellow-800 mb-3">Monitoring & Alerting</h3>
              <ul className="list-disc list-inside text-yellow-700 space-y-2">
                <li>Set up alerts for response time degradation above 200ms</li>
                <li>Monitor recommendation accuracy during high-load periods</li>
                <li>Track conversion rates to ensure scaling maintains business KPIs</li>
                <li>Configure emergency escalation procedures for ops teams</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Integration Examples */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Integration Examples</h2>
          
          <div className="bg-gray-900 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">SDK Integration (Node.js)</h3>
            <pre className="text-green-400 text-sm overflow-x-auto"><code>{`const SchlepEngine = require('@schlep-engine/sdk');

const scaling = new SchlepEngine.Scaling({
  apiKey: process.env.SCHLEP_API_KEY,
  environment: 'production'
});

// Configure seasonal scaling
async function setupHolidayScaling() {
  const config = await scaling.configure({
    scalingPolicy: {
      predictiveEnabled: true,
      trafficForecastDays: 14,
      targetResponseTime: '150ms',
      minInstances: 10,
      maxInstances: 1000
    },
    seasonalPatterns: {
      blackFriday: {
        date: '2024-11-29',
        expectedMultiplier: 45,
        preScaleHours: 6
      },
      cyberMonday: {
        date: '2024-12-02',
        expectedMultiplier: 32,
        preScaleHours: 4
      }
    }
  });
  
  console.log('Scaling configured:', config.policyId);
  return config;
}

// Monitor scaling status during events
async function monitorScalingStatus() {
  const status = await scaling.getStatus();
  
  console.log(\`Current load: \${status.performanceMetrics.currentLoad}\`);
  console.log(\`Response time: \${status.performanceMetrics.averageResponseTime}\`);
  console.log(\`Active instances: \${status.scalingStatus.currentInstances}\`);
  
  // Alert if performance degrades
  if (status.performanceMetrics.p95ResponseTime > '200ms') {
    await notifyOpsTeam('High latency detected during scaling event');
  }
  
  return status;
}

// Emergency scaling override
async function emergencyScale() {
  const emergency = await scaling.emergency({
    action: 'maximum_scale',
    reason: 'unexpected_viral_traffic',
    duration: '2_hours',
    priorityMode: 'high_value_customers'
  });
  
  console.log('Emergency scaling activated:', emergency.activationId);
  return emergency;
}

module.exports = {
  setupHolidayScaling,
  monitorScalingStatus,
  emergencyScale
};`}</code></pre>
          </div>
        </section>

        {/* Next Steps */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Implementation Support</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Link href="/contact" className="block p-6 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
              <TrendingUp className="h-8 w-8 text-blue-600 mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Seasonal Scaling Consultation</h3>
              <p className="text-gray-600">Work with our e-commerce scaling experts to design and implement auto-scaling for your specific traffic patterns and seasonal events.</p>
            </Link>
            
            <Link href="/case-studies/ecommerce-seasonal-scaling" className="block p-6 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
              <ShoppingCart className="h-8 w-8 text-green-600 mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">MegaMart Case Study</h3>
              <p className="text-gray-600">See how MegaMart handled 15x Black Friday traffic with zero downtime using our seasonal scaling solution.</p>
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}