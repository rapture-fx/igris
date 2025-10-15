'use client';

import React from 'react';
import { MaturityIndicator, MaturitySection } from '../../../components/ui/MaturityIndicator';
import { ImplementationRoadmap, RoadmapPresets } from '../../../components/ui/ImplementationRoadmap';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Code, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';

export default function ReinforcementLearningPage() {
  const rlRoadmap = RoadmapPresets.MLFeatures().filter(item => 
    item.id === 'rl-full' || item.id === 'basic-ml'
  );

  return (
    <div className="space-y-8">
      {/* Page Header with Maturity Indicator */}
      <div className="space-y-4">
        <h1 className="text-4xl font-bold">Reinforcement Learning Optimization</h1>
        
        <MaturityIndicator 
          level="compatibility"
          feature="RL Optimization System"
          description="Advanced statistical optimization with optional RL enhancement when dependencies available"
          performanceNote="Compatibility Mode: 8-15% improvement over baseline | Full RL: 20-35% improvement"
          dependencyNote="Compatible mode: Built-in statistical optimization | Full RL: stable-baselines3, gymnasium, tensorboard"
          showFullDescription={true}
        />

        <p className="text-lg text-gray-600">
          Our RL system provides intelligent optimization that adapts to your deployment environment. 
          When advanced dependencies are available, it leverages cutting-edge reinforcement learning. 
          When not, it uses sophisticated statistical methods that still deliver significant improvements.
        </p>
      </div>

      {/* Deployment Modes */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Deployment Modes</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Compatibility Mode */}
          <MaturitySection
            title="Compatibility Mode"
            level="production"
            performanceData={{
              metric: "Optimization Improvement",
              value: "8-15% over baseline",
              conditions: "Tested on 500+ concurrent users, various data types"
            }}
            dependencies={{
              required: ["NumPy", "SciPy", "scikit-learn"],
              optional: []
            }}
          >
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                <strong>Always Available:</strong> Runs with built-in dependencies using advanced statistical methods.
              </p>
              
              <ul className="text-sm space-y-1 ml-4">
                <li>• <strong>Bayesian Optimization:</strong> Gaussian process-based parameter tuning</li>
                <li>• <strong>Simulated Annealing:</strong> Global optimization with cooling schedules</li>
                <li>• <strong>Grid Search++:</strong> Intelligent parameter space exploration</li>
                <li>• <strong>Statistical Analysis:</strong> Performance trend analysis and prediction</li>
              </ul>

              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Production Ready:</strong> This mode powers our validated performance metrics 
                  and provides reliable optimization for all deployment scenarios.
                </AlertDescription>
              </Alert>
            </div>
          </MaturitySection>

          {/* Full RL Mode */}
          <MaturitySection
            title="Full RL Mode"
            level="beta"
            performanceData={{
              metric: "Optimization Improvement", 
              value: "20-35% over baseline",
              conditions: "When stable-baselines3 and dependencies available"
            }}
            dependencies={{
              required: ["stable-baselines3", "gymnasium", "tensorboard"],
              optional: ["CUDA", "PyTorch", "TensorFlow"]
            }}
          >
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                <strong>Enhanced Performance:</strong> Advanced RL agents for complex optimization scenarios.
              </p>
              
              <ul className="text-sm space-y-1 ml-4">
                <li>• <strong>PPO Agents:</strong> Proximal Policy Optimization for stable learning</li>
                <li>• <strong>SAC Integration:</strong> Soft Actor-Critic for continuous actions</li>
                <li>• <strong>A2C Support:</strong> Advantage Actor-Critic for multi-objective optimization</li>
                <li>• <strong>Custom Environments:</strong> Industry-specific reward functions</li>
              </ul>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Beta Status:</strong> Architecture complete, final optimization in progress. 
                  Automatically falls back to compatibility mode when dependencies unavailable.
                </AlertDescription>
              </Alert>
            </div>
          </MaturitySection>
        </div>
      </div>

      {/* API Endpoints */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">API Endpoints</h2>

        {/* Optimization Endpoint */}
        <MaturitySection
          title="POST /api/v1/rl/optimize"
          level="production"
          performanceData={{
            metric: "Response Time",
            value: "50-200ms",
            conditions: "Simple optimization tasks, compatibility mode"
          }}
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Optimize parameters using available RL or statistical methods.
            </p>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Request Example</h4>
              <pre className="text-sm bg-white p-3 rounded border overflow-x-auto">
{`{
  "optimization_type": "hyperparameter_tuning",
  "parameters": {
    "learning_rate": {"min": 0.001, "max": 0.1},
    "batch_size": {"options": [16, 32, 64, 128]},
    "epochs": {"min": 10, "max": 100}
  },
  "objective": "minimize_loss",
  "max_iterations": 50,
  "timeout_minutes": 30
}`}
              </pre>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Response Example</h4>
              <pre className="text-sm bg-white p-3 rounded border overflow-x-auto">
{`{
  "optimization_id": "opt_abc123",
  "status": "completed",
  "mode": "compatibility",
  "best_parameters": {
    "learning_rate": 0.0234,
    "batch_size": 64,
    "epochs": 45
  },
  "improvement_percentage": 12.4,
  "iterations_completed": 28,
  "processing_time_ms": 127,
  "algorithm_used": "bayesian_optimization"
}`}
              </pre>
            </div>
          </div>
        </MaturitySection>

        {/* Status Check Endpoint */}
        <MaturitySection
          title="GET /api/v1/rl/optimize/{id}/status"
          level="production"
        >
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              Check optimization progress and retrieve results.
            </p>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Response Example</h4>
              <pre className="text-sm bg-white p-3 rounded border overflow-x-auto">
{`{
  "optimization_id": "opt_abc123",
  "status": "running",
  "progress_percentage": 65,
  "current_best_score": 0.847,
  "iterations_completed": 18,
  "estimated_time_remaining_ms": 45000,
  "mode": "full_rl",
  "agent_type": "ppo"
}`}
              </pre>
            </div>
          </div>
        </MaturitySection>
      </div>

      {/* Implementation Status */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Implementation Roadmap</h2>
        
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Current Status:</strong> The RL system is architecturally complete with sophisticated 
            fallback mechanisms. Full RL capabilities are in final optimization phase, while compatibility 
            mode provides production-ready optimization for all scenarios.
          </AlertDescription>
        </Alert>

        <ImplementationRoadmap
          title="RL Development Progress"
          description="Progression from statistical optimization to full reinforcement learning capabilities"
          items={rlRoadmap}
          showTimeline={true}
        />
      </div>

      {/* Performance Benchmarks */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Performance Benchmarks</h2>
        
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-green-50 p-4 rounded-lg border">
            <h4 className="font-semibold text-green-800">Compatibility Mode</h4>
            <div className="text-2xl font-bold text-green-900">8-15%</div>
            <p className="text-sm text-green-700">Average improvement over baseline</p>
            <p className="text-xs text-green-600 mt-1">Tested on 500+ concurrent users</p>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg border">
            <h4 className="font-semibold text-blue-800">Response Time</h4>
            <div className="text-2xl font-bold text-blue-900">50-200ms</div>
            <p className="text-sm text-blue-700">Optimization endpoint response</p>
            <p className="text-xs text-blue-600 mt-1">Simple to moderate complexity tasks</p>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg border">
            <h4 className="font-semibold text-purple-800">Full RL Mode</h4>
            <div className="text-2xl font-bold text-purple-900">20-35%</div>
            <p className="text-sm text-purple-700">Enhanced improvement potential</p>
            <p className="text-xs text-purple-600 mt-1">When dependencies available</p>
          </div>
        </div>
      </div>

      {/* Installation Guide */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Installation & Setup</h2>
        
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Badge variant="default" className="bg-green-100 text-green-800">Basic</Badge>
              Compatibility Mode (Always Available)
            </h4>
            <pre className="text-sm bg-white p-3 rounded border overflow-x-auto">
{`# No additional setup required
# Uses built-in statistical optimization
pip install schlep-engine`}
            </pre>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">Enhanced</Badge>
              Full RL Mode Setup
            </h4>
            <pre className="text-sm bg-white p-3 rounded border overflow-x-auto">
{`# Install RL dependencies for enhanced performance
pip install schlep-engine[rl]

# Or install individually:
pip install stable-baselines3 gymnasium tensorboard

# Optional GPU acceleration:
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121`}
            </pre>
          </div>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            The system automatically detects available dependencies and selects the best mode. 
            No configuration changes needed - optimization happens transparently.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}