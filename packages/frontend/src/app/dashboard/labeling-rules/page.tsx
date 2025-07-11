import React from 'react';
import { RulesToolbar } from '@/components/labeling-rules/RulesToolbar';
import { RulesList } from '@/components/labeling-rules/RulesList';

const LabelingRulesPage = () => {
  return (
    <div className="h-full flex flex-col">
       <div className="p-4 md:p-6">
         <h1 className="text-2xl font-bold mb-4">Labeling Rules</h1>
       </div>
       <div className="flex-grow p-4 md:p-6 bg-gray-50 dark:bg-gray-900">
        <RulesToolbar />
        <RulesList />
      </div>
    </div>
  );
};

export default LabelingRulesPage; 