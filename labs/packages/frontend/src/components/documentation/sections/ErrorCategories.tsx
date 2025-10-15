import React from 'react';
import { 
  AlertTriangle, 
  Shield, 
  Clock, 
  AlertCircle 
} from 'lucide-react';

interface ErrorCategory {
  name: string;
  color: string;
  icon: string;
  description: string;
  examples: string[];
  recoveryActions: string[];
}

interface ErrorCategoriesProps {
  errorCategories: ErrorCategory[];
}

const iconMap = {
  'AlertTriangle': AlertTriangle,
  'Shield': Shield,
  'Clock': Clock,
  'AlertCircle': AlertCircle,
};

const colorMap = {
  yellow: 'bg-yellow-50 border-yellow-200',
  red: 'bg-red-50 border-red-200',
  orange: 'bg-orange-50 border-orange-200',
  blue: 'bg-blue-50 border-blue-200',
};

const iconColorMap = {
  yellow: 'text-yellow-600',
  red: 'text-red-600',
  orange: 'text-orange-600',
  blue: 'text-blue-600',
};

const textColorMap = {
  yellow: 'text-yellow-900',
  red: 'text-red-900',
  orange: 'text-orange-900',
  blue: 'text-blue-900',
};

export const ErrorCategories: React.FC<ErrorCategoriesProps> = ({ errorCategories }) => {
  if (!errorCategories || errorCategories.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          🚨 Error Categories
        </h3>
        <p className="text-sm text-gray-600">
          Common error types and recommended recovery strategies
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {errorCategories.map((category, index) => {
          const IconComponent = iconMap[category.icon as keyof typeof iconMap];
          const colorClass = colorMap[category.color as keyof typeof colorMap];
          const iconColorClass = iconColorMap[category.color as keyof typeof iconColorMap];
          const textColorClass = textColorMap[category.color as keyof typeof textColorMap];
          
          return (
            <div key={index} className={`border rounded-lg p-6 ${colorClass}`}>
              <div className="flex items-start mb-4">
                {IconComponent && (
                  <IconComponent className={`w-6 h-6 mr-3 mt-1 ${iconColorClass}`} />
                )}
                <div className="flex-1">
                  <h4 className={`text-base font-semibold ${textColorClass} mb-2`}>
                    {category.name}
                  </h4>
                  <p className={`text-sm ${textColorClass} opacity-80 mb-4`}>
                    {category.description}
                  </p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h5 className={`text-sm font-medium ${textColorClass} mb-2`}>
                    Common Examples:
                  </h5>
                  <ul className="space-y-1">
                    {category.examples.map((example, idx) => (
                      <li key={idx} className={`text-xs ${textColorClass} opacity-90`}>
                        • {example}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h5 className={`text-sm font-medium ${textColorClass} mb-2`}>
                    Recovery Actions:
                  </h5>
                  <ul className="space-y-1">
                    {category.recoveryActions.map((action, idx) => (
                      <li key={idx} className={`text-xs ${textColorClass} opacity-90`}>
                        ✓ {action}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ErrorCategories; 