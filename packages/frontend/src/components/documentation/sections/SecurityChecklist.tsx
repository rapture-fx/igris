import React from 'react';
import { 
  KeyIcon, 
  ShieldCheckIcon, 
  LockClosedIcon, 
  GlobeAltIcon 
} from '@heroicons/react/24/outline';
import { ContentSectionItem } from '../../../types/documentation';

interface SecurityChecklistProps {
  section: ContentSectionItem;
}

const iconMap = {
  'key': KeyIcon,
  'shield-check': ShieldCheckIcon,
  'lock-closed': LockClosedIcon,
  'globe-alt': GlobeAltIcon,
};

export const SecurityChecklist: React.FC<SecurityChecklistProps> = ({ section }) => {
  if (!section.securityCategories) return null;

  return (
    <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-red-900 mb-6">
        🔒 Security Checklist
      </h3>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {section.securityCategories.map((category, index) => {
          const IconComponent = iconMap[category.icon as keyof typeof iconMap];
          
          return (
            <div key={index} className="bg-white bg-opacity-60 rounded-lg p-4">
              <div className="flex items-center mb-3">
                {IconComponent && (
                  <IconComponent className="w-5 h-5 text-red-600 mr-2" />
                )}
                <h4 className="text-sm font-semibold text-red-800">
                  {category.name}
                </h4>
              </div>
              
              <ul className="space-y-2">
                {category.practices.map((practice, idx) => (
                  <li key={idx} className="text-xs text-red-700 flex items-start">
                    <span className="text-red-500 mr-2">•</span>
                    <span>{practice}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      
      <div className="mt-6 p-4 bg-red-100 bg-opacity-50 rounded-lg">
        <p className="text-sm text-red-800">
          <strong>💡 Pro Tip:</strong> Implement all checklist items for comprehensive security. 
          Regular security audits and penetration testing are recommended for production environments.
        </p>
      </div>
    </div>
  );
}; 