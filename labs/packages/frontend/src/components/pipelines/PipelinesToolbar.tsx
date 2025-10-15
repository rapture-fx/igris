'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export const PipelinesToolbar = () => {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center space-x-2">
        <Input placeholder="Search pipelines..." className="max-w-xs" />
        {/* Add filters here if needed */}
      </div>
      <Button>Create Pipeline</Button>
    </div>
  );
}; 