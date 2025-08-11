import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Pipeline } from './types';

interface PipelineCardProps {
  pipeline: Pipeline;
}

const statusMap: { [key in Pipeline['status']]: string } = {
  active: 'bg-green-500',
  inactive: 'bg-gray-500',
  error: 'bg-red-500',
};

export const PipelineCard: React.FC<PipelineCardProps> = ({ pipeline }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{pipeline.name}</span>
          <Badge className={`${statusMap[pipeline.status]} text-white`}>{pipeline.status}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-500 mb-2">{pipeline.description}</p>
        <div className="text-sm">
          <p><strong>Source:</strong> {pipeline.sourceType}</p>
          <p><strong>Destination:</strong> {pipeline.destinationType}</p>
          <p><strong>Last Run:</strong> {new Date(pipeline.lastRun).toLocaleString()}</p>
          <p><strong>Runs:</strong> {pipeline.runCount} (✅ {pipeline.successCount} / ❌ {pipeline.errorCount})</p>
        </div>
      </CardContent>
    </Card>
  );
}; 