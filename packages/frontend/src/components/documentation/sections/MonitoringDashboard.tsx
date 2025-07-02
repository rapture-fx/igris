import React from 'react';
import { 
  ChartBarIcon, 
  ClockIcon, 
  ExclamationTriangleIcon 
} from '@heroicons/react/24/outline';
import { ContentSectionItem } from '../../../types/documentation';

interface MonitoringDashboardProps {
  section: ContentSectionItem;
}

const iconMap = {
  'chart-bar': ChartBarIcon,
  'clock': ClockIcon,
  'exclamation-triangle': ExclamationTriangleIcon,
};

const colorMap = {
  blue: 'bg-blue-50 border-blue-200',
  green: 'bg-green-50 border-green-200',
  orange: 'bg-orange-50 border-orange-200',
};

const iconColorMap = {
  blue: 'text-blue-600',
  green: 'text-green-600',
  orange: 'text-orange-600',
};

const textColorMap = {
  blue: 'text-blue-900',
  green: 'text-green-900',
  orange: 'text-orange-900',
};

const badgeColorMap = {
  blue: 'bg-blue-100 text-blue-800',
  green: 'bg-green-100 text-green-800',
  orange: 'bg-orange-100 text-orange-800',
};

const typeIconMap: Record<string, string> = {
  'chart': '📊',
  'gauge': '⚡',
  'table': '📋',
  'alert': '🚨',
  'metric': '📈',
  'log': '📝'
};

export const MonitoringDashboard: React.FC<MonitoringDashboardProps> = ({ section }) => {
  if (!section.monitoringDashboards) return null;

  return (
    <div className="space-y-8">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          📊 Monitoring Dashboard
        </h3>
        <p className="text-sm text-gray-600">
          Real-time monitoring widgets and metrics visualization
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {section.monitoringDashboards.map((dashboard, index) => {
          const IconComponent = iconMap[dashboard.icon as keyof typeof iconMap];
          const colorClass = colorMap[dashboard.color as keyof typeof colorMap];
          const iconColorClass = iconColorMap[dashboard.color as keyof typeof iconColorMap];
          const textColorClass = textColorMap[dashboard.color as keyof typeof textColorMap];
          const badgeColorClass = badgeColorMap[dashboard.color as keyof typeof badgeColorMap];
          
          return (
            <div key={index} className={`border rounded-lg p-6 ${colorClass}`}>
              <div className="flex items-center mb-4">
                {IconComponent && (
                  <IconComponent className={`w-6 h-6 mr-3 ${iconColorClass}`} />
                )}
                <h4 className={`text-base font-semibold ${textColorClass}`}>
                  {dashboard.category}
                </h4>
              </div>
              
              <div className="space-y-3">
                {dashboard.widgets.map((widget, widgetIndex) => (
                  <div key={widgetIndex} className="bg-white bg-opacity-60 rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center">
                        <span className="text-sm mr-2">
                          {typeIconMap[widget.type] || '📊'}
                        </span>
                        <h5 className={`text-sm font-medium ${textColorClass}`}>
                          {widget.name}
                        </h5>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${badgeColorClass}`}>
                        {widget.type}
                      </span>
                    </div>
                    <p className={`text-xs ${textColorClass} opacity-80`}>
                      {widget.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-gradient-to-r from-gray-50 to-blue-50 border border-gray-200 rounded-lg p-6">
        <h4 className="text-base font-semibold text-gray-900 mb-4">
          🎯 Dashboard Customization
        </h4>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h5 className="text-sm font-medium text-gray-800 mb-2">Widget Configuration</h5>
            <ul className="text-xs text-gray-700 space-y-1">
              <li>• Drag and drop widget arrangement</li>
              <li>• Custom time ranges and filters</li>
              <li>• Threshold-based alerts and notifications</li>
              <li>• Export capabilities for reports</li>
            </ul>
          </div>
          <div>
            <h5 className="text-sm font-medium text-gray-800 mb-2">Dashboard Sharing</h5>
            <ul className="text-xs text-gray-700 space-y-1">
              <li>• Share dashboards with team members</li>
              <li>• Embed dashboards in external applications</li>
              <li>• Schedule automated dashboard reports</li>
              <li>• Role-based dashboard access control</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}; 