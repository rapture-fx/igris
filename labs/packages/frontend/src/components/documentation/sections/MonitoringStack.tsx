import React from 'react';
import { 
  BarChart3, 
  Bell, 
  FileText, 
  Settings,
  ExternalLink,
  CheckCircle
} from 'lucide-react';

interface Tool {
  name: string;
  purpose: string;
  integration: string;
}

interface StackCategory {
  category: string;
  description: string;
  tools: Tool[];
}

interface MonitoringStackProps {
  monitoringStack: StackCategory[];
}

const getCategoryIcon = (category: string) => {
  if (category.toLowerCase().includes('metrics')) return BarChart3;
  if (category.toLowerCase().includes('alert')) return Bell;
  if (category.toLowerCase().includes('logging')) return FileText;
  return Settings;
};

const getCategoryColor = (index: number) => {
  const colors = ['blue', 'orange', 'green'];
  return colors[index % colors.length];
};

const colorMap = {
  blue: 'bg-blue-50 border-blue-200',
  orange: 'bg-orange-50 border-orange-200',
  green: 'bg-green-50 border-green-200',
};

const iconColorMap = {
  blue: 'text-blue-600',
  orange: 'text-orange-600',
  green: 'text-green-600',
};

const textColorMap = {
  blue: 'text-blue-900',
  orange: 'text-orange-900',
  green: 'text-green-900',
};

const badgeColorMap = {
  blue: 'bg-blue-100 text-blue-800',
  orange: 'bg-orange-100 text-orange-800',
  green: 'bg-green-100 text-green-800',
};

export const MonitoringStack: React.FC<MonitoringStackProps> = ({ monitoringStack }) => {
  if (!monitoringStack || monitoringStack.length === 0) return null;

  return (
    <div className="space-y-8">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          🔧 Monitoring Technology Stack
        </h3>
        <p className="text-sm text-gray-600">
          Integration with industry-standard monitoring and observability tools
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {monitoringStack.map((stackCategory, index) => {
          const IconComponent = getCategoryIcon(stackCategory.category);
          const color = getCategoryColor(index);
          const colorClass = colorMap[color as keyof typeof colorMap];
          const iconColorClass = iconColorMap[color as keyof typeof iconColorMap];
          const textColorClass = textColorMap[color as keyof typeof textColorMap];
          const badgeColorClass = badgeColorMap[color as keyof typeof badgeColorMap];
          
          return (
            <div key={index} className={`border rounded-lg p-6 ${colorClass}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <IconComponent className={`w-6 h-6 mr-3 ${iconColorClass}`} />
                  <h4 className={`text-base font-semibold ${textColorClass}`}>
                    {stackCategory.category}
                  </h4>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${badgeColorClass}`}>
                  Stack
                </span>
              </div>
              
              <p className={`text-sm ${textColorClass} opacity-80 mb-4`}>
                {stackCategory.description}
              </p>
              
              <div className="space-y-3">
                {stackCategory.tools.map((tool, toolIndex) => (
                  <div key={toolIndex} className="bg-white bg-opacity-70 rounded-lg p-4 border border-gray-200 border-opacity-50">
                    <div className="flex items-start justify-between mb-2">
                      <h5 className={`text-sm font-medium ${textColorClass} flex items-center`}>
                        <CheckCircle className={`w-4 h-4 mr-2 ${iconColorClass}`} />
                        {tool.name}
                      </h5>
                      <ExternalLink className={`w-3 h-3 ${iconColorClass} opacity-60`} />
                    </div>
                    
                    <p className={`text-xs ${textColorClass} opacity-70 mb-2`}>
                      {tool.purpose}
                    </p>
                    
                    <div className="flex items-center">
                      <span className={`text-xs font-medium ${textColorClass} mr-2`}>
                        Integration:
                      </span>
                      <span className={`text-xs ${textColorClass} opacity-80 bg-white bg-opacity-60 px-2 py-1 rounded`}>
                        {tool.integration}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-200 border-opacity-50">
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${textColorClass} opacity-70`}>
                    {stackCategory.tools.length} integrations
                  </span>
                  <div className="flex items-center">
                    <Settings className={`w-3 h-3 mr-1 ${iconColorClass}`} />
                    <span className={`text-xs ${textColorClass} opacity-70`}>
                      Ready to use
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-lg p-6 mt-6">
        <div className="flex items-start">
          <Settings className="w-6 h-6 text-blue-600 mr-3 mt-1" />
          <div>
            <h5 className="text-base font-semibold text-gray-900 mb-2">
              Integration Best Practices
            </h5>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-700">
              <div>
                <h6 className="font-medium mb-2">Setup Guidelines:</h6>
                <ul className="space-y-1 text-xs">
                  <li>• Configure proper retention policies for metrics</li>
                  <li>• Set up appropriate alert thresholds</li>
                  <li>• Ensure secure API key management</li>
                </ul>
              </div>
              <div>
                <h6 className="font-medium mb-2">Monitoring Strategy:</h6>
                <ul className="space-y-1 text-xs">
                  <li>• Monitor both technical and business metrics</li>
                  <li>• Implement progressive alerting levels</li>
                  <li>• Regular review of monitoring effectiveness</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonitoringStack; 