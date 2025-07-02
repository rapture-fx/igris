import React from 'react';
import { 
  Mail, 
  Calendar, 
  Database, 
  Building2,
  CheckCircle,
  AlertTriangle,
  Info
} from 'lucide-react';

interface ValidationRule {
  name: string;
  description: string;
  color: string;
  icon: string;
  severity: string;
  features: string[];
  useCase: string;
}

interface ValidationRulesProps {
  validationRules: ValidationRule[];
}

const iconMap = {
  'Mail': Mail,
  'Calendar': Calendar,
  'Database': Database,
  'Building2': Building2,
  'CheckCircle': CheckCircle,
  'AlertTriangle': AlertTriangle,
  'Info': Info,
};

const colorMap = {
  blue: 'bg-blue-50 border-blue-200',
  green: 'bg-green-50 border-green-200',
  purple: 'bg-purple-50 border-purple-200',
  orange: 'bg-orange-50 border-orange-200',
  red: 'bg-red-50 border-red-200',
};

const iconColorMap = {
  blue: 'text-blue-600',
  green: 'text-green-600',
  purple: 'text-purple-600',
  orange: 'text-orange-600',
  red: 'text-red-600',
};

const textColorMap = {
  blue: 'text-blue-900',
  green: 'text-green-900',
  purple: 'text-purple-900',
  orange: 'text-orange-900',
  red: 'text-red-900',
};

const getSeverityIcon = (severity: string) => {
  switch (severity.toUpperCase()) {
    case 'ERROR': return AlertTriangle;
    case 'WARNING': return Info;
    default: return CheckCircle;
  }
};

const getSeverityColor = (severity: string) => {
  switch (severity.toUpperCase()) {
    case 'ERROR': return 'text-red-600 bg-red-100';
    case 'WARNING': return 'text-yellow-600 bg-yellow-100';
    default: return 'text-green-600 bg-green-100';
  }
};

export const ValidationRules: React.FC<ValidationRulesProps> = ({ validationRules }) => {
  if (!validationRules || validationRules.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          ✅ Custom Validation Rules
        </h3>
        <p className="text-sm text-gray-600">
          Define and implement custom validation logic for your data
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {validationRules.map((rule, index) => {
          const IconComponent = iconMap[rule.icon as keyof typeof iconMap];
          const SeverityIconComponent = getSeverityIcon(rule.severity);
          const colorClass = colorMap[rule.color as keyof typeof colorMap];
          const iconColorClass = iconColorMap[rule.color as keyof typeof iconColorMap];
          const textColorClass = textColorMap[rule.color as keyof typeof textColorMap];
          const severityColorClass = getSeverityColor(rule.severity);
          
          return (
            <div key={index} className={`border rounded-lg p-6 ${colorClass} transition-all duration-200 hover:shadow-lg`}>
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  {IconComponent && (
                    <IconComponent className={`w-6 h-6 mr-3 ${iconColorClass}`} />
                  )}
                  <h4 className={`text-base font-semibold ${textColorClass}`}>
                    {rule.name}
                  </h4>
                </div>
                <div className="flex items-center">
                  <SeverityIconComponent className={`w-4 h-4 mr-1 ${severityColorClass.split(' ')[0]}`} />
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${severityColorClass}`}>
                    {rule.severity}
                  </span>
                </div>
              </div>
              
              {/* Description */}
              <p className={`text-sm ${textColorClass} opacity-90 mb-4`}>
                {rule.description}
              </p>
              
              {/* Features */}
              <div className="mb-4">
                <h5 className={`text-sm font-medium ${textColorClass} mb-2`}>Features:</h5>
                <div className="space-y-2">
                  {rule.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="bg-white bg-opacity-60 rounded-lg p-2">
                      <div className="flex items-start">
                        <CheckCircle className={`w-3 h-3 ${iconColorClass} mt-0.5 mr-2 flex-shrink-0`} />
                        <span className={`text-xs ${textColorClass} opacity-80`}>
                          {feature}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Use Case */}
              <div className="mt-4 pt-4 border-t border-gray-200 border-opacity-50">
                <div className="flex items-start">
                  <div className={`w-2 h-2 rounded-full ${iconColorClass.replace('text-', 'bg-')} mt-1.5 mr-2 flex-shrink-0`}></div>
                  <div>
                    <h6 className={`text-xs font-medium ${textColorClass} mb-1`}>Use Cases:</h6>
                    <p className={`text-xs ${textColorClass} opacity-70`}>
                      {rule.useCase}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ValidationRules; 