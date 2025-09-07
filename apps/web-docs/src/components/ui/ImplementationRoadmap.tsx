'use client'

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Progress } from './progress';
import { Badge } from './badge';
import { Calendar, Target, CheckCircle2, Clock, ArrowRight } from 'lucide-react';

export interface RoadmapItem {
  id: string;
  feature: string;
  description: string;
  currentStatus: 'completed' | 'in_progress' | 'planned';
  targetQuarter: string;
  progressPercentage: number;
  dependencies?: string[];
  technicalNotes?: string;
}

export interface ImplementationRoadmapProps {
  title: string;
  description?: string;
  items: RoadmapItem[];
  showTimeline?: boolean;
}

const statusConfig = {
  completed: {
    color: 'bg-green-100 text-green-800',
    icon: CheckCircle2,
    label: 'Completed'
  },
  in_progress: {
    color: 'bg-blue-100 text-blue-800', 
    icon: Clock,
    label: 'In Progress'
  },
  planned: {
    color: 'bg-gray-100 text-gray-800',
    icon: Target,
    label: 'Planned'
  }
};

function RoadmapItemCard({ item }: { item: RoadmapItem }) {
  const config = statusConfig[item.currentStatus];
  const StatusIcon = config.icon;

  return (
    <Card className="roadmap-item relative">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={config.color}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {config.label}
            </Badge>
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Calendar className="w-3 h-3" />
              {item.targetQuarter}
            </div>
          </div>
        </div>
        <CardTitle className="text-lg">{item.feature}</CardTitle>
        <CardDescription>{item.description}</CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Progress</span>
            <span className="font-medium">{item.progressPercentage}%</span>
          </div>
          <Progress value={item.progressPercentage} className="h-2" />
        </div>

        {/* Dependencies */}
        {item.dependencies && item.dependencies.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Dependencies</h4>
            <div className="flex flex-wrap gap-1">
              {item.dependencies.map((dep, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {dep}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Technical Notes */}
        {item.technicalNotes && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Technical Notes</h4>
            <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
              {item.technicalNotes}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TimelineView({ items }: { items: RoadmapItem[] }) {
  const quarters = Array.from(new Set(items.map(item => item.targetQuarter))).sort();
  
  return (
    <div className="timeline-view space-y-6">
      {quarters.map((quarter, quarterIndex) => {
        const quarterItems = items.filter(item => item.targetQuarter === quarter);
        
        return (
          <div key={quarter} className="timeline-quarter">
            <div className="flex items-center gap-3 mb-4">
              <div className="timeline-marker w-3 h-3 bg-blue-600 rounded-full"></div>
              <h3 className="text-lg font-semibold text-gray-800">{quarter}</h3>
              <div className="flex-1 h-px bg-gray-200"></div>
            </div>
            
            <div className="timeline-items ml-6 space-y-4">
              {quarterItems.map((item) => (
                <div key={item.id} className="timeline-item relative">
                  <div className="absolute -left-6 w-2 h-2 bg-gray-400 rounded-full top-6"></div>
                  <RoadmapItemCard item={item} />
                </div>
              ))}
            </div>
            
            {quarterIndex < quarters.length - 1 && (
              <div className="flex justify-center py-4">
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ImplementationRoadmap({ 
  title, 
  description, 
  items, 
  showTimeline = true 
}: ImplementationRoadmapProps) {
  // Calculate overall progress
  const overallProgress = items.reduce((sum, item) => sum + item.progressPercentage, 0) / items.length;
  
  // Count status distribution
  const statusCounts = items.reduce((counts, item) => {
    counts[item.currentStatus] = (counts[item.currentStatus] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);

  return (
    <div className="implementation-roadmap space-y-6">
      {/* Header */}
      <div className="roadmap-header">
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        {description && (
          <p className="text-gray-600 mt-2">{description}</p>
        )}
        
        {/* Overall Progress */}
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium text-gray-700">Overall Implementation Progress</h3>
            <span className="text-sm font-bold text-gray-900">{Math.round(overallProgress)}%</span>
          </div>
          <Progress value={overallProgress} className="h-3" />
          
          {/* Status Summary */}
          <div className="flex gap-4 mt-3">
            {Object.entries(statusCounts).map(([status, count]) => {
              const config = statusConfig[status as keyof typeof statusConfig];
              return (
                <div key={status} className="flex items-center gap-2">
                  <Badge variant="secondary" className={`${config.color} text-xs`}>
                    {count} {config.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Roadmap Content */}
      {showTimeline ? (
        <TimelineView items={items} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <RoadmapItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

// Preset roadmaps for common features
export const RoadmapPresets = {
  MLFeatures: (): RoadmapItem[] => [
    {
      id: 'basic-ml',
      feature: 'Basic ML Pipeline',
      description: 'Core scikit-learn based ML operations',
      currentStatus: 'completed',
      targetQuarter: 'Q1 2024',
      progressPercentage: 100,
      technicalNotes: '155,876+ lines of production code with comprehensive testing'
    },
    {
      id: 'advanced-ml', 
      feature: 'Advanced ML Models',
      description: 'Deep learning with TensorFlow/PyTorch integration',
      currentStatus: 'in_progress',
      targetQuarter: 'Q2 2024',
      progressPercentage: 75,
      dependencies: ['TensorFlow', 'PyTorch', 'CUDA (optional)'],
      technicalNotes: 'Architecture implemented, training pipelines in final testing'
    },
    {
      id: 'rl-full',
      feature: 'Full RL Implementation', 
      description: 'Complete reinforcement learning with stable-baselines3',
      currentStatus: 'in_progress',
      targetQuarter: 'Q3 2024',
      progressPercentage: 60,
      dependencies: ['stable-baselines3', 'gymnasium', 'tensorboard'],
      technicalNotes: 'Environment design complete, agent training optimization ongoing'
    },
    {
      id: 'automl',
      feature: 'AutoML Pipeline',
      description: 'Automated model selection and hyperparameter tuning',
      currentStatus: 'planned',
      targetQuarter: 'Q4 2024',
      progressPercentage: 25,
      dependencies: ['optuna', 'ray-tune', 'mlflow'],
      technicalNotes: 'Research phase, evaluating AutoML frameworks'
    }
  ],

  IndustryVerticals: (): RoadmapItem[] => [
    {
      id: 'manufacturing-basic',
      feature: 'Manufacturing Analytics',
      description: 'Basic manufacturing data processing and quality control',
      currentStatus: 'completed',
      targetQuarter: 'Q1 2024',
      progressPercentage: 100,
      technicalNotes: 'Statistical process control and basic anomaly detection'
    },
    {
      id: 'manufacturing-advanced',
      feature: 'Predictive Maintenance AI',
      description: 'Advanced ML for equipment failure prediction',
      currentStatus: 'in_progress',
      targetQuarter: 'Q2 2024',
      progressPercentage: 70,
      dependencies: ['Sensor fusion algorithms', 'Time series ML models'],
      technicalNotes: 'Vibration analysis and spectral feature extraction implemented'
    },
    {
      id: 'financial-compliance',
      feature: 'Financial Compliance Suite',
      description: 'AML, fraud detection, and regulatory reporting',
      currentStatus: 'in_progress',
      targetQuarter: 'Q3 2024',
      progressPercentage: 65,
      dependencies: ['Financial data providers', 'Compliance frameworks'],
      technicalNotes: 'Core fraud detection complete, AML workflows in development'
    },
    {
      id: 'ecommerce-personalization',
      feature: 'E-commerce AI Engine',
      description: 'Advanced recommendation and personalization systems',
      currentStatus: 'planned',
      targetQuarter: 'Q4 2024',
      progressPercentage: 35,
      dependencies: ['Collaborative filtering', 'Real-time inference'],
      technicalNotes: 'Architecture design phase, proof-of-concept development'
    }
  ],

  Infrastructure: (): RoadmapItem[] => [
    {
      id: 'aws-deployment',
      feature: 'AWS Production Infrastructure',
      description: 'Complete AWS deployment with Terraform',
      currentStatus: 'completed',
      targetQuarter: 'Q1 2024', 
      progressPercentage: 100,
      technicalNotes: 'Multi-AZ deployment with auto-scaling, validated for 500+ users'
    },
    {
      id: 'kubernetes-scaling',
      feature: 'Kubernetes Auto-scaling',
      description: 'Advanced container orchestration and resource management',
      currentStatus: 'completed',
      targetQuarter: 'Q1 2024',
      progressPercentage: 95,
      technicalNotes: 'HPA configured, load tested, monitoring integrated'
    },
    {
      id: 'multi-cloud',
      feature: 'Multi-cloud Support',
      description: 'GCP and Azure deployment options',
      currentStatus: 'planned',
      targetQuarter: 'Q3 2024',
      progressPercentage: 20,
      dependencies: ['GCP Terraform modules', 'Azure Resource Manager'],
      technicalNotes: 'Architecture planning and compatibility assessment'
    },
    {
      id: 'edge-deployment',
      feature: 'Edge Computing Integration',
      description: 'Lightweight deployments for edge and IoT scenarios',
      currentStatus: 'planned',
      targetQuarter: 'Q4 2024',
      progressPercentage: 10,
      dependencies: ['ARM support', 'Container optimization', 'Offline capabilities'],
      technicalNotes: 'Requirements gathering and feasibility analysis'
    }
  ]
};

// FeatureProgression component for showing feature development stages
export interface FeatureProgressionProps {
  features: Array<{
    name: string;
    currentStage: 'concept' | 'development' | 'testing' | 'production';
    description?: string;
    progress: number;
  }>;
  title?: string;
  showDetails?: boolean;
}

export function FeatureProgression({ 
  features, 
  title = "Feature Development Progression",
  showDetails = false 
}: FeatureProgressionProps) {
  const stageConfig = {
    concept: { color: 'bg-gray-100 text-gray-800', label: 'Concept', icon: Target },
    development: { color: 'bg-blue-100 text-blue-800', label: 'Development', icon: Clock },
    testing: { color: 'bg-yellow-100 text-yellow-800', label: 'Testing', icon: CheckCircle2 },
    production: { color: 'bg-green-100 text-green-800', label: 'Production', icon: CheckCircle2 }
  };

  return (
    <div className="feature-progression space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      
      <div className="space-y-3">
        {features.map((feature, index) => {
          const config = stageConfig[feature.currentStage];
          const StageIcon = config.icon;
          
          return (
            <Card key={index} className="feature-progression-item">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <h4 className="font-medium text-gray-900">{feature.name}</h4>
                    <Badge variant="secondary" className={`${config.color} text-xs`}>
                      <StageIcon className="w-3 h-3 mr-1" />
                      {config.label}
                    </Badge>
                  </div>
                  <span className="text-sm font-medium text-gray-600">{feature.progress}%</span>
                </div>
                
                <Progress value={feature.progress} className="h-2 mb-2" />
                
                {showDetails && feature.description && (
                  <p className="text-sm text-gray-600 mt-2">{feature.description}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// Named exports for backwards compatibility
export { ImplementationRoadmap };

// Default export
export default ImplementationRoadmap;