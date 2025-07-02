import React from 'react';
import { 
  LockClosedIcon, 
  UserGroupIcon, 
  DocumentCheckIcon, 
  ShieldExclamationIcon 
} from '@heroicons/react/24/outline';
import { ContentSectionItem } from '../../../types/documentation';

interface SecurityFeaturesProps {
  section: ContentSectionItem;
}

const iconMap = {
  'lock-closed': LockClosedIcon,
  'user-group': UserGroupIcon,
  'document-check': DocumentCheckIcon,
  'shield-exclamation': ShieldExclamationIcon,
};

const colorMap = {
  blue: 'bg-blue-50 border-blue-200',
  green: 'bg-green-50 border-green-200',
  purple: 'bg-purple-50 border-purple-200',
  orange: 'bg-orange-50 border-orange-200',
};

const iconColorMap = {
  blue: 'text-blue-600',
  green: 'text-green-600',
  purple: 'text-purple-600',
  orange: 'text-orange-600',
};

const textColorMap = {
  blue: 'text-blue-900',
  green: 'text-green-900',
  purple: 'text-purple-900',
  orange: 'text-orange-900',
};

export const SecurityFeatures: React.FC<SecurityFeaturesProps> = ({ section }) => {
  if (!section.securityFeatures) return null;

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          🛡️ Enterprise Security Features
        </h3>
        <p className="text-sm text-gray-600">
          Comprehensive security capabilities for enterprise-grade data protection
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {section.securityFeatures.map((feature, index) => {
          const IconComponent = iconMap[feature.icon as keyof typeof iconMap];
          const colorClass = colorMap[feature.color as keyof typeof colorMap];
          const iconColorClass = iconColorMap[feature.color as keyof typeof iconColorMap];
          const textColorClass = textColorMap[feature.color as keyof typeof textColorMap];
          
          return (
            <div key={index} className={`border rounded-lg p-6 ${colorClass}`}>
              <div className="flex items-start mb-4">
                {IconComponent && (
                  <IconComponent className={`w-6 h-6 mr-3 mt-1 ${iconColorClass}`} />
                )}
                <div className="flex-1">
                  <h4 className={`text-base font-semibold ${textColorClass} mb-1`}>
                    {feature.name}
                  </h4>
                  <p className={`text-sm ${textColorClass} opacity-80`}>
                    {feature.description}
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
                {feature.capabilities.map((capability, idx) => (
                  <div key={idx} className={`text-sm ${textColorClass} opacity-90 flex items-start`}>
                    <span className="text-current mr-2 mt-1">✓</span>
                    <span>{capability}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">
          🏆 Security Certifications & Compliance
        </h4>
        <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-700">
          <div>
            <strong>SOC 2 Type II:</strong> Audited security controls and processes
          </div>
          <div>
            <strong>ISO 27001:</strong> Information security management certification
          </div>
          <div>
            <strong>GDPR & CCPA:</strong> Privacy regulation compliance tools
          </div>
        </div>
      </div>
    </div>
  );
}; 