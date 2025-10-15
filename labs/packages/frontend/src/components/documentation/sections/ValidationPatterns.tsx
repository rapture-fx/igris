import React from 'react';
import { 
  DollarSign, 
  Heart, 
  ShoppingCart, 
  Cpu,
  Building2,
  CheckCircle,
  AlertCircle,
  Code,
  Target
} from 'lucide-react';

interface ValidationPattern {
  pattern: string;
  description: string;
  complexity: string;
  icon: string;
  validations: string[];
  industries: string[];
  implementation: string[];
}

interface ValidationPatternsProps {
  validationPatterns: ValidationPattern[];
}

const iconMap = {
  'DollarSign': DollarSign,
  'Heart': Heart,
  'ShoppingCart': ShoppingCart,
  'Cpu': Cpu,
  'Building2': Building2,
  'CheckCircle': CheckCircle,
  'AlertCircle': AlertCircle,
  'Code': Code,
  'Target': Target,
};

const getComplexityColor = (complexity: string) => {
  switch (complexity.toLowerCase()) {
    case 'low': return 'bg-green-100 text-green-800';
    case 'medium': return 'bg-yellow-100 text-yellow-800';
    case 'high': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getPatternColor = (pattern: string) => {
  if (pattern.toLowerCase().includes('financial')) return 'border-blue-200 bg-blue-50';
  if (pattern.toLowerCase().includes('healthcare')) return 'border-green-200 bg-green-50';
  if (pattern.toLowerCase().includes('commerce')) return 'border-purple-200 bg-purple-50';
  if (pattern.toLowerCase().includes('iot')) return 'border-orange-200 bg-orange-50';
  return 'border-gray-200 bg-gray-50';
};

const getPatternIconColor = (pattern: string) => {
  if (pattern.toLowerCase().includes('financial')) return 'text-blue-600';
  if (pattern.toLowerCase().includes('healthcare')) return 'text-green-600';
  if (pattern.toLowerCase().includes('commerce')) return 'text-purple-600';
  if (pattern.toLowerCase().includes('iot')) return 'text-orange-600';
  return 'text-gray-600';
};

const getPatternTextColor = (pattern: string) => {
  if (pattern.toLowerCase().includes('financial')) return 'text-blue-900';
  if (pattern.toLowerCase().includes('healthcare')) return 'text-green-900';
  if (pattern.toLowerCase().includes('commerce')) return 'text-purple-900';
  if (pattern.toLowerCase().includes('iot')) return 'text-orange-900';
  return 'text-gray-900';
};

export const ValidationPatterns: React.FC<ValidationPatternsProps> = ({ validationPatterns }) => {
  if (!validationPatterns || validationPatterns.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          🎯 Common Validation Patterns
        </h3>
        <p className="text-sm text-gray-600">
          Pre-built validation patterns for common use cases
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {validationPatterns.map((pattern, index) => {
          const IconComponent = iconMap[pattern.icon as keyof typeof iconMap];
          const complexityColorClass = getComplexityColor(pattern.complexity);
          const patternColorClass = getPatternColor(pattern.pattern);
          const iconColorClass = getPatternIconColor(pattern.pattern);
          const textColorClass = getPatternTextColor(pattern.pattern);
          
          return (
            <div key={index} className={`border rounded-lg p-6 ${patternColorClass} transition-all duration-200 hover:shadow-lg`}>
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  {IconComponent && (
                    <IconComponent className={`w-6 h-6 mr-3 ${iconColorClass}`} />
                  )}
                  <div>
                    <h4 className={`text-base font-semibold ${textColorClass}`}>
                      {pattern.pattern}
                    </h4>
                    <p className={`text-sm ${textColorClass} opacity-80 mt-1`}>
                      {pattern.description}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${complexityColorClass}`}>
                  {pattern.complexity}
                </span>
              </div>
              
              {/* Validations */}
              <div className="mb-4">
                <h5 className={`text-sm font-medium ${textColorClass} mb-2 flex items-center`}>
                  <CheckCircle className={`w-4 h-4 mr-2 ${iconColorClass}`} />
                  Validations:
                </h5>
                <div className="space-y-2">
                  {pattern.validations.map((validation, validationIndex) => (
                    <div key={validationIndex} className="bg-white bg-opacity-60 rounded-lg p-2">
                      <div className="flex items-start">
                        <div className={`w-2 h-2 rounded-full ${iconColorClass.replace('text-', 'bg-')} mt-2 mr-3 flex-shrink-0`}></div>
                        <span className={`text-sm ${textColorClass} opacity-90`}>
                          {validation}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Industries */}
              <div className="mb-4">
                <h5 className={`text-sm font-medium ${textColorClass} mb-2 flex items-center`}>
                  <Building2 className={`w-4 h-4 mr-2 ${iconColorClass}`} />
                  Industries:
                </h5>
                <div className="flex flex-wrap gap-2">
                  {pattern.industries.map((industry, industryIndex) => (
                    <span key={industryIndex} className={`px-2 py-1 text-xs font-medium rounded-full bg-white ${textColorClass} opacity-80`}>
                      {industry}
                    </span>
                  ))}
                </div>
              </div>
              
              {/* Implementation Steps */}
              <div className="mb-4">
                <h5 className={`text-sm font-medium ${textColorClass} mb-2 flex items-center`}>
                  <Code className={`w-4 h-4 mr-2 ${iconColorClass}`} />
                  Implementation:
                </h5>
                <div className="space-y-2">
                  {pattern.implementation.slice(0, 3).map((step, stepIndex) => (
                    <div key={stepIndex} className="bg-white bg-opacity-60 rounded-lg p-2">
                      <div className="flex items-start">
                        <span className={`inline-flex items-center justify-center w-4 h-4 ${iconColorClass.replace('text-', 'bg-')} text-white rounded-full text-xs font-medium mr-2 mt-0.5 flex-shrink-0`}>
                          {stepIndex + 1}
                        </span>
                        <span className={`text-xs ${textColorClass} opacity-80`}>
                          {step}
                        </span>
                      </div>
                    </div>
                  ))}
                  {pattern.implementation.length > 3 && (
                    <div className="text-xs text-gray-500 pl-6">
                      +{pattern.implementation.length - 3} more steps
                    </div>
                  )}
                </div>
              </div>
              
              {/* Footer */}
              <div className="pt-4 border-t border-gray-200 border-opacity-50">
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${textColorClass} opacity-70`}>
                    {pattern.validations.length} validations • {pattern.implementation.length} steps
                  </span>
                  <div className="flex items-center">
                    <Target className={`w-3 h-3 mr-1 ${iconColorClass}`} />
                    <span className={`text-xs ${textColorClass} opacity-70`}>
                      Production ready
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Pattern Implementation Guide */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-6 mt-6">
        <div className="flex items-start">
          <Target className="w-6 h-6 text-indigo-600 mr-3 mt-1" />
          <div>
            <h5 className="text-base font-semibold text-gray-900 mb-2">
              Pattern Implementation Guide
            </h5>
            <div className="grid md:grid-cols-3 gap-6 text-sm text-gray-700">
              <div>
                <h6 className="font-medium mb-2 text-indigo-900">1. Select Pattern:</h6>
                <ul className="space-y-1 text-xs">
                  <li>• Choose industry-specific pattern</li>
                  <li>• Review validation requirements</li>
                  <li>• Assess complexity level</li>
                  <li>• Check implementation steps</li>
                </ul>
              </div>
              <div>
                <h6 className="font-medium mb-2 text-indigo-900">2. Customize Rules:</h6>
                <ul className="space-y-1 text-xs">
                  <li>• Adapt to your data schema</li>
                  <li>• Configure business logic</li>
                  <li>• Set appropriate severity levels</li>
                  <li>• Add custom error messages</li>
                </ul>
              </div>
              <div>
                <h6 className="font-medium mb-2 text-indigo-900">3. Deploy & Monitor:</h6>
                <ul className="space-y-1 text-xs">
                  <li>• Test with sample data</li>
                  <li>• Deploy to production</li>
                  <li>• Monitor validation results</li>
                  <li>• Refine rules as needed</li>
                </ul>
              </div>
            </div>
            
            {/* Pattern Complexity Guide */}
            <div className="mt-4 bg-white rounded-lg p-4 border border-indigo-200">
              <h6 className="text-sm font-medium text-indigo-900 mb-2">Complexity Levels:</h6>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="border-r border-gray-200 pr-4">
                  <div className="text-lg font-bold text-green-600">LOW</div>
                  <div className="text-xs text-gray-600">Simple rules, quick setup</div>
                </div>
                <div className="border-r border-gray-200 pr-4">
                  <div className="text-lg font-bold text-yellow-600">MEDIUM</div>
                  <div className="text-xs text-gray-600">Cross-field validation</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-red-600">HIGH</div>
                  <div className="text-xs text-gray-600">Complex business logic</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ValidationPatterns; 