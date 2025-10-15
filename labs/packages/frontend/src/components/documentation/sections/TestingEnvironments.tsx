import React from 'react';
import { TestTube, Database } from 'lucide-react';

interface TestingEnvironment {
  name: string;
  color: string;
  icon: string;
  features: string[];
}

interface TestingEnvironmentsProps {
  testingEnvironments: TestingEnvironment[];
}

const iconMap = {
  TestTube,
  Database
};

const TestingEnvironments: React.FC<TestingEnvironmentsProps> = ({ testingEnvironments }) => {
  return (
    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
      <h3 className="text-base font-semibold text-green-900 mb-3">Testing Environments</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {testingEnvironments.map((environment, index) => {
          const IconComponent = iconMap[environment.icon as keyof typeof iconMap];
          
          return (
            <div key={index}>
              <div className="flex items-center gap-2 mb-2">
                {IconComponent && <IconComponent className="w-4 h-4 text-green-600" />}
                <h4 className="text-sm font-medium text-green-800">{environment.name}</h4>
              </div>
              <ul className="text-xs text-green-700 space-y-1">
                {environment.features.map((feature, featureIndex) => (
                  <li key={featureIndex}>• {feature}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TestingEnvironments; 