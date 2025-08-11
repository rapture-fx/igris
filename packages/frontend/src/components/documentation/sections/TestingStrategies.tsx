import React from 'react';
import { CheckSquare, GitBranch, Activity } from 'lucide-react';

interface TestingStrategy {
  category: string;
  description: string;
  practices: string[];
}

interface TestingStrategiesProps {
  testingStrategies: TestingStrategy[];
}

const getStrategyIcon = (category: string) => {
  switch (category.toLowerCase()) {
    case 'unit testing':
      return CheckSquare;
    case 'integration testing':
      return GitBranch;
    case 'load testing':
      return Activity;
    default:
      return CheckSquare;
  }
};

const getStrategyColor = (category: string) => {
  switch (category.toLowerCase()) {
    case 'unit testing':
      return 'blue';
    case 'integration testing':
      return 'purple';
    case 'load testing':
      return 'orange';
    default:
      return 'blue';
  }
};

const TestingStrategies: React.FC<TestingStrategiesProps> = ({ testingStrategies }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Testing Strategies</h3>
      <div className="grid gap-4">
        {testingStrategies.map((strategy, index) => {
          const IconComponent = getStrategyIcon(strategy.category);
          const color = getStrategyColor(strategy.category);
          
          return (
            <div 
              key={index}
              className={`bg-white border border-${color}-200 rounded-lg p-4 hover:shadow-md transition-shadow`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 bg-${color}-50 rounded-lg`}>
                  <IconComponent className={`w-5 h-5 text-${color}-600`} />
                </div>
                <div className="flex-1">
                  <h4 className={`text-base font-semibold text-${color}-900 mb-2`}>
                    {strategy.category}
                  </h4>
                  <p className="text-sm text-gray-600 mb-3">
                    {strategy.description}
                  </p>
                  <div className="space-y-2">
                    <h5 className="text-xs font-medium text-gray-800 uppercase tracking-wide">
                      Best Practices
                    </h5>
                    <ul className="text-sm text-gray-700 space-y-1">
                      {strategy.practices.map((practice, practiceIndex) => (
                        <li key={practiceIndex} className="flex items-start gap-2">
                          <span className={`w-1.5 h-1.5 bg-${color}-400 rounded-full mt-2 flex-shrink-0`}></span>
                          <span>{practice}</span>
                        </li>
                      ))}
                    </ul>
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

export default TestingStrategies; 