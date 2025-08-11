import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LabelingRule } from './types';

interface RuleCardProps {
  rule: LabelingRule;
}

export const RuleCard: React.FC<RuleCardProps> = ({ rule }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{rule.name}</span>
          <Badge variant={rule.isActive ? 'default' : 'secondary'}>
            {rule.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-500 mb-2">{rule.description}</p>
        <div className="text-sm space-y-1">
          <p><strong>Applies Label:</strong> <Badge variant="outline">{rule.label}</Badge></p>
          <p className="font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded">
            <strong>Criteria:</strong> {rule.criteria}
          </p>
          <p><strong>Coverage:</strong> {(rule.coverage * 100).toFixed(1)}%</p>
          <p className="text-xs text-gray-400">Created: {new Date(rule.createdAt).toLocaleDateString()}</p>
        </div>
      </CardContent>
    </Card>
  );
}; 