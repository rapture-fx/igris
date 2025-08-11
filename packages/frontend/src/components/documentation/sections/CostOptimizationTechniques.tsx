import React from 'react';
import { 
  Layers, 
  Settings, 
  Clock, 
  Zap,
  TrendingUp,
  CheckCircle,
  Target,
  BarChart3
} from 'lucide-react';

interface CostOptimizationTechnique {
  technique: string;
  description: string;
  savingsRange: string;
  complexity: string;
  implementation: string[];
  benefits: string[];
}

interface CostOptimizationTechniquesProps {
  costOptimizationTechniques: CostOptimizationTechnique[];
}

const getComplexityColor = (complexity: string) => {
  switch (complexity.toLowerCase()) {
    case 'low': return 'bg-green-100 text-green-800';
    case 'medium': return 'bg-yellow-100 text-yellow-800';
    case 'high': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getSavingsColor = (range: string) => {
  const percentage = parseInt(range.split('-')[1] || range.split('%')[0]);
  if (percentage >= 40) return 'text-green-600';
  if (percentage >= 25) return 'text-blue-600';
  if (percentage >= 15) return 'text-orange-600';
  return 'text-gray-600';
};

const getTechniqueIcon = (technique: string) => {
  if (technique.toLowerCase().includes('batch')) return Layers;
  if (technique.toLowerCase().includes('adaptive')) return Settings;
  if (technique.toLowerCase().includes('scheduled')) return Clock;
  if (technique.toLowerCase().includes('resource')) return Zap;
  return Target;
};

export const CostOptimizationTechniques: React.FC<CostOptimizationTechniquesProps> = ({ costOptimizationTechniques }) => {
  if (!costOptimizationTechniques || costOptimizationTechniques.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          🔧 Advanced Optimization Techniques
        </h3>
        <p className="text-sm text-gray-600">
          Advanced techniques to reduce costs while maintaining data quality
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {costOptimizationTechniques.map((technique, index) => {
          const IconComponent = getTechniqueIcon(technique.technique);
          const complexityColorClass = getComplexityColor(technique.complexity);
          const savingsColorClass = getSavingsColor(technique.savingsRange);
          
          return (
            <div key={index} className="bg-white border border-gray-200 rounded-lg p-6 transition-all duration-200 hover:shadow-lg hover:border-blue-300">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <IconComponent className="w-6 h-6 text-blue-600 mr-3" />
                  <div>
                    <h4 className="text-base font-semibold text-gray-900">
                      {technique.technique}
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {technique.description}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Metrics */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className={`text-lg font-bold ${savingsColorClass}`}>
                    {technique.savingsRange}
                  </div>
                  <div className="text-xs text-gray-600">Potential Savings</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${complexityColorClass}`}>
                    {technique.complexity}
                  </span>
                  <div className="text-xs text-gray-600 mt-1">Complexity</div>
                </div>
              </div>
              
              {/* Implementation Steps */}
              <div className="mb-4">
                <h5 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                  <Settings className="w-4 h-4 text-gray-600 mr-2" />
                  Implementation Steps:
                </h5>
                <ul className="space-y-2">
                  {technique.implementation.map((step, stepIndex) => (
                    <li key={stepIndex} className="bg-blue-50 rounded-lg p-2">
                      <div className="flex items-start">
                        <span className="inline-flex items-center justify-center w-5 h-5 bg-blue-100 text-blue-600 rounded-full text-xs font-medium mr-2 mt-0.5 flex-shrink-0">
                          {stepIndex + 1}
                        </span>
                        <span className="text-sm text-gray-700">
                          {step}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              
              {/* Benefits */}
              <div className="mb-4">
                <h5 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                  <TrendingUp className="w-4 h-4 text-green-600 mr-2" />
                  Key Benefits:
                </h5>
                <ul className="space-y-2">
                  {technique.benefits.map((benefit, benefitIndex) => (
                    <li key={benefitIndex} className="bg-green-50 rounded-lg p-2">
                      <div className="flex items-start">
                        <CheckCircle className="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-700">
                          {benefit}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              
              {/* Footer */}
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {technique.implementation.length} steps • {technique.benefits.length} benefits
                  </span>
                  <div className="flex items-center">
                    <Target className="w-3 h-3 text-blue-600 mr-1" />
                    <span className="text-xs text-gray-600">
                      Ready to implement
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Implementation Roadmap */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mt-6">
        <div className="flex items-start">
          <BarChart3 className="w-6 h-6 text-blue-600 mr-3 mt-1" />
          <div>
            <h5 className="text-base font-semibold text-gray-900 mb-2">
              Optimization Implementation Roadmap
            </h5>
            <div className="grid md:grid-cols-3 gap-6 text-sm text-gray-700">
              <div>
                <h6 className="font-medium mb-2 text-blue-900">Phase 1 - Quick Wins (1-2 weeks):</h6>
                <ul className="space-y-1 text-xs">
                  <li>• Implement scheduled processing</li>
                  <li>• Configure basic batching rules</li>
                  <li>• Set up cost monitoring alerts</li>
                  <li>• Enable off-peak processing</li>
                </ul>
              </div>
              <div>
                <h6 className="font-medium mb-2 text-blue-900">Phase 2 - Advanced (2-4 weeks):</h6>
                <ul className="space-y-1 text-xs">
                  <li>• Deploy adaptive processing logic</li>
                  <li>• Implement smart batching algorithms</li>
                  <li>• Configure dynamic scaling</li>
                  <li>• Set up cost forecasting</li>
                </ul>
              </div>
              <div>
                <h6 className="font-medium mb-2 text-blue-900">Phase 3 - Optimization (4-8 weeks):</h6>
                <ul className="space-y-1 text-xs">
                  <li>• Deploy resource right-sizing</li>
                  <li>• Implement ML-based optimization</li>
                  <li>• Configure advanced monitoring</li>
                  <li>• Continuous improvement cycle</li>
                </ul>
              </div>
            </div>
            
            {/* Expected ROI */}
            <div className="mt-4 bg-white rounded-lg p-4 border border-blue-200">
              <h6 className="text-sm font-medium text-blue-900 mb-2">Expected ROI by Phase:</h6>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">15-25%</div>
                  <div className="text-xs text-gray-600">Phase 1 Savings</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600">25-40%</div>
                  <div className="text-xs text-gray-600">Phase 2 Savings</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-purple-600">40-60%</div>
                  <div className="text-xs text-gray-600">Phase 3 Savings</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CostOptimizationTechniques; 