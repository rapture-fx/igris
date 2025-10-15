import React from 'react';
import { 
  AlertTriangle, 
  Target, 
  Zap,
  Settings,
  CheckCircle,
  Info,
  AlertCircle
} from 'lucide-react';

interface ValidationSetting {
  name: string;
  description: string;
  action: string;
  recommended: string;
}

interface ValidationConfigurationCategory {
  category: string;
  description: string;
  color: string;
  icon: string;
  settings: ValidationSetting[];
}

interface ValidationConfigurationProps {
  validationConfiguration: ValidationConfigurationCategory[];
}

const iconMap = {
  'AlertTriangle': AlertTriangle,
  'Target': Target,
  'Zap': Zap,
  'Settings': Settings,
  'CheckCircle': CheckCircle,
  'Info': Info,
  'AlertCircle': AlertCircle,
};

const colorMap = {
  red: 'bg-red-50 border-red-200',
  blue: 'bg-blue-50 border-blue-200',
  green: 'bg-green-50 border-green-200',
  purple: 'bg-purple-50 border-purple-200',
  orange: 'bg-orange-50 border-orange-200',
};

const iconColorMap = {
  red: 'text-red-600',
  blue: 'text-blue-600',
  green: 'text-green-600',
  purple: 'text-purple-600',
  orange: 'text-orange-600',
};

const textColorMap = {
  red: 'text-red-900',
  blue: 'text-blue-900',
  green: 'text-green-900',
  purple: 'text-purple-900',
  orange: 'text-orange-900',
};

const badgeColorMap = {
  red: 'bg-red-100 text-red-800',
  blue: 'bg-blue-100 text-blue-800',
  green: 'bg-green-100 text-green-800',
  purple: 'bg-purple-100 text-purple-800',
  orange: 'bg-orange-100 text-orange-800',
};

export const ValidationConfiguration: React.FC<ValidationConfigurationProps> = ({ validationConfiguration }) => {
  if (!validationConfiguration || validationConfiguration.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          ⚙️ Validation Configuration
        </h3>
        <p className="text-sm text-gray-600">
          Configure validation behaviors and severity levels
        </p>
      </div>

      <div className="space-y-6">
        {validationConfiguration.map((category, index) => {
          const IconComponent = iconMap[category.icon as keyof typeof iconMap];
          const colorClass = colorMap[category.color as keyof typeof colorMap];
          const iconColorClass = iconColorMap[category.color as keyof typeof iconColorMap];
          const textColorClass = textColorMap[category.color as keyof typeof textColorMap];
          const badgeColorClass = badgeColorMap[category.color as keyof typeof badgeColorMap];
          
          return (
            <div key={index} className={`border rounded-lg p-6 ${colorClass} transition-all duration-200 hover:shadow-lg`}>
              {/* Category Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  {IconComponent && (
                    <IconComponent className={`w-6 h-6 mr-3 ${iconColorClass}`} />
                  )}
                  <div>
                    <h4 className={`text-base font-semibold ${textColorClass}`}>
                      {category.category}
                    </h4>
                    <p className={`text-sm ${textColorClass} opacity-80 mt-1`}>
                      {category.description}
                    </p>
                  </div>
                </div>
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${badgeColorClass}`}>
                  {category.settings.length} options
                </span>
              </div>
              
              {/* Settings */}
              <div className="space-y-4">
                {category.settings.map((setting, settingIndex) => (
                  <div key={settingIndex} className="bg-white bg-opacity-60 rounded-lg p-4 border border-gray-200 border-opacity-50">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full ${iconColorClass.replace('text-', 'bg-')} mr-3 mt-1 flex-shrink-0`}></div>
                        <h5 className={`text-sm font-semibold ${textColorClass}`}>
                          {setting.name}
                        </h5>
                      </div>
                    </div>
                    
                    <div className="ml-6 space-y-2">
                      <p className={`text-sm ${textColorClass} opacity-90`}>
                        {setting.description}
                      </p>
                      
                      <div className="grid md:grid-cols-2 gap-4 mt-3">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <h6 className="text-xs font-medium text-gray-700 mb-1">Action:</h6>
                          <p className="text-xs text-gray-600">
                            {setting.action}
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <h6 className="text-xs font-medium text-gray-700 mb-1">Recommended for:</h6>
                          <p className="text-xs text-gray-600">
                            {setting.recommended}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ValidationConfiguration;