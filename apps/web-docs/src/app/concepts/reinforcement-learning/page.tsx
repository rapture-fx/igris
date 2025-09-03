'use client'

import { useState } from 'react'
import { CpuChipIcon, ChartBarIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import CodeBlock from '../../../components/ui/CodeBlock'

export default function ReinforcementLearningPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Reinforcement Learning</h1>
        <p className="text-xl text-gray-600">
          Advanced RL algorithms for hyperparameter optimization, dynamic pricing, and supply chain management. 
          Our PPO agents learn optimal strategies through continuous interaction with your business environments.
        </p>
      </div>

      {/* RL Overview */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">How Our RL System Works</h2>
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <CpuChipIcon className="h-12 w-12 text-blue-600 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Agent Learning</h3>
              <p className="text-sm text-gray-600">PPO agents observe business metrics and learn optimal actions</p>
            </div>
            <div className="text-center">
              <ChartBarIcon className="h-12 w-12 text-purple-600 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Environment Interaction</h3>
              <p className="text-sm text-gray-600">Agents interact with real business environments and constraints</p>
            </div>
            <div className="text-center">
              <ArrowPathIcon className="h-12 w-12 text-green-600 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Continuous Optimization</h3>
              <p className="text-sm text-gray-600">Policies improve over time through reward-based learning</p>
            </div>
          </div>
        </div>
      </section>

      {/* RL Use Cases */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">RL Applications</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3 text-blue-600">🔧 Hyperparameter Optimization</h3>
            <p className="text-sm text-gray-600 mb-4">
              RL agents automatically tune ML model hyperparameters to maximize performance metrics like F1-score, accuracy, or custom business objectives.
            </p>
            <div className="text-xs text-gray-500">
              <p><strong>State:</strong> Current model performance, training metrics</p>
              <p><strong>Action:</strong> Hyperparameter adjustments (learning rate, batch size, etc.)</p>
              <p><strong>Reward:</strong> Model performance improvement</p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3 text-green-600">💰 Dynamic Pricing</h3>
            <p className="text-sm text-gray-600 mb-4">
              RL agents learn optimal pricing strategies by balancing profit margins, competitive positioning, and demand elasticity.
            </p>
            <div className="text-xs text-gray-500">
              <p><strong>State:</strong> Market conditions, competitor prices, demand data</p>
              <p><strong>Action:</strong> Price adjustments within constraints</p>
              <p><strong>Reward:</strong> Profit maximization + market share</p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3 text-purple-600">🏭 Supply Chain Optimization</h3>
            <p className="text-sm text-gray-600 mb-4">
              RL agents optimize inventory levels, procurement timing, and logistics routing to minimize costs while maintaining service levels.
            </p>
            <div className="text-xs text-gray-500">
              <p><strong>State:</strong> Inventory levels, demand forecasts, supplier data</p>
              <p><strong>Action:</strong> Order quantities, timing, routing decisions</p>
              <p><strong>Reward:</strong> Cost reduction + service level targets</p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3 text-orange-600">📊 Resource Allocation</h3>
            <p className="text-sm text-gray-600 mb-4">
              RL agents dynamically allocate computational resources, budget, or personnel based on changing business priorities and constraints.
            </p>
            <div className="text-xs text-gray-500">
              <p><strong>State:</strong> Resource utilization, priority queues, constraints</p>
              <p><strong>Action:</strong> Resource assignment decisions</p>
              <p><strong>Reward:</strong> Efficiency + priority achievement</p>
            </div>
          </div>
        </div>
      </section>

      {/* Technical Implementation */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Technical Implementation</h2>
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="font-semibold mb-4">PPO Hyperparameter Optimization Example</h3>
          <p className="text-gray-600 mb-4">
            Our RL system uses Proximal Policy Optimization (PPO) agents with custom reward functions 
            to automatically tune ML model hyperparameters for optimal performance.
          </p>
          <CodeBlock
            code={`from schlep_engine import SchlepClient

client = SchlepClient(api_key="your_api_key")

# Start RL-powered hyperparameter optimization
optimization_job = client.ml.optimize_hyperparameters(
    model_type="gradient_boosting",
    dataset_id="customer_churn_data",
    target_metric="f1_score",
    optimization_budget={
        "max_trials": 100,
        "max_time_hours": 4,
        "compute_budget": "medium"
    },
    hyperparameter_space={
        "learning_rate": {"type": "log_uniform", "low": 0.001, "high": 0.3},
        "max_depth": {"type": "int", "low": 3, "high": 12},
        "n_estimators": {"type": "int", "low": 50, "high": 500},
        "subsample": {"type": "uniform", "low": 0.6, "high": 1.0}
    },
    constraints={
        "max_model_size_mb": 100,
        "max_inference_time_ms": 200
    }
)

# Monitor optimization progress
status = client.ml.get_optimization_status(optimization_job.id)
print(f"Current best F1-score: ${'{'}{status.best_score}{'}'}")
print(f"Trials completed: ${'{'}{status.trials_completed}{'}'}")
print(f"Best hyperparameters: ${'{'}{status.best_params}{'}'}")

# Expected Output after optimization:
# Current best F1-score: 0.847
# Trials completed: 100
# Best hyperparameters: {
#   'learning_rate': 0.087, 
#   'max_depth': 8, 
#   'n_estimators': 247, 
#   'subsample': 0.82
# }`}
            language="python"
            title="RL Hyperparameter Optimization"
            showCopyButton={true}
          />
        </div>
      </section>

      {/* RL Architecture */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">RL System Architecture</h2>
        <div className="bg-blue-50 border-l-4 border-blue-400 p-6">
          <h3 className="font-semibold mb-3">Production RL Infrastructure</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div>
              <h4 className="font-medium mb-2">Core Components:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• <strong>PPO Agents:</strong> Proximal Policy Optimization with custom reward functions</li>
                <li>• <strong>Environment Simulators:</strong> Business logic simulation for safe learning</li>
                <li>• <strong>Experience Replay:</strong> Efficient learning from historical interactions</li>
                <li>• <strong>Policy Checkpoints:</strong> Model versioning and rollback capabilities</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Production Features:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• <strong>A/B Testing:</strong> Safe policy deployment with gradual rollouts</li>
                <li>• <strong>Real-time Monitoring:</strong> Policy performance and drift detection</li>
                <li>• <strong>Constraint Handling:</strong> Business rule enforcement during optimization</li>
                <li>• <strong>Multi-objective:</strong> Balancing multiple business objectives</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Performance Metrics */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">RL Performance</h2>
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold mb-4">Typical RL Optimization Results</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded">
              <p className="text-2xl font-bold text-blue-600">23%</p>
              <p className="text-sm text-gray-600">ML Performance Improvement</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded">
              <p className="text-2xl font-bold text-green-600">67%</p>
              <p className="text-sm text-gray-600">Faster Hyperparameter Tuning</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded">
              <p className="text-2xl font-bold text-purple-600">15%</p>
              <p className="text-sm text-gray-600">Revenue Increase (Pricing)</p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded">
              <p className="text-2xl font-bold text-orange-600">31%</p>
              <p className="text-sm text-gray-600">Cost Reduction (Supply Chain)</p>
            </div>
          </div>
        </div>
      </section>

      {/* API Reference */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">RL API Endpoints</h2>
        <div className="space-y-4">
          <div className="bg-gray-50 rounded p-4">
            <div className="flex items-center justify-between mb-2">
              <code className="text-sm font-mono">POST /api/v1/rl/hyperparameter-optimization</code>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">POST</span>
            </div>
            <p className="text-sm text-gray-600">Start RL-powered hyperparameter optimization for ML models</p>
          </div>
          
          <div className="bg-gray-50 rounded p-4">
            <div className="flex items-center justify-between mb-2">
              <code className="text-sm font-mono">POST /api/v1/rl/pricing-optimization</code>
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">POST</span>
            </div>
            <p className="text-sm text-gray-600">Deploy RL agents for dynamic pricing strategy optimization</p>
          </div>
          
          <div className="bg-gray-50 rounded p-4">
            <div className="flex items-center justify-between mb-2">
              <code className="text-sm font-mono">GET /api/v1/rl/agent-performance/{'{id}'}</code>
              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">GET</span>
            </div>
            <p className="text-sm text-gray-600">Monitor RL agent performance and learning progress</p>
          </div>
        </div>
      </section>
    </div>
  )
}