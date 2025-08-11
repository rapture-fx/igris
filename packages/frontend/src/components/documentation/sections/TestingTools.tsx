import React from 'react';
import { Wrench, Database, CheckCircle } from 'lucide-react';

interface TestingTool {
  name: string;
  description: string;
  useCase: string;
  features: string[];
}

interface TestingToolsProps {
  testingTools: TestingTool[];
}

const getToolIcon = (name: string) => {
  switch (name.toLowerCase()) {
    case 'mock client':
      return Wrench;
    case 'sample data generator':
      return Database;
    case 'test assertions':
      return CheckCircle;
    default:
      return Wrench;
  }
};

const getToolColor = (index: number) => {
  const colors = ['indigo', 'teal', 'rose'];
  return colors[index % colors.length];
};

const TestingTools: React.FC<TestingToolsProps> = ({ testingTools }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Testing Tools</h3>
      <div className="grid md:grid-cols-3 gap-4">
        {testingTools.map((tool, index) => {
          const IconComponent = getToolIcon(tool.name);
          const color = getToolColor(index);
          
          return (
            <div 
              key={index}
              className={`bg-white border border-${color}-200 rounded-lg p-4 hover:shadow-md transition-shadow`}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className={`p-2 bg-${color}-50 rounded-lg`}>
                  <IconComponent className={`w-5 h-5 text-${color}-600`} />
                </div>
                <div className="flex-1">
                  <h4 className={`text-base font-semibold text-${color}-900 mb-1`}>
                    {tool.name}
                  </h4>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    {tool.useCase}
                  </p>
                </div>
              </div>
              
              <p className="text-sm text-gray-600 mb-3">
                {tool.description}
              </p>
              
              <div className="space-y-2">
                <h5 className="text-xs font-medium text-gray-800 uppercase tracking-wide">
                  Features
                </h5>
                <ul className="text-sm text-gray-700 space-y-1">
                  {tool.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-2">
                      <span className={`w-1.5 h-1.5 bg-${color}-400 rounded-full mt-2 flex-shrink-0`}></span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TestingTools; 