'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wrench, Plus, CheckCircle, XCircle, TrendingUp } from 'lucide-react';

interface AgentTool {
  id: string;
  name: string;
  category: string;
  enabled: boolean;
  usage_count: number;
  success_rate: number;
  avg_execution_time: number;
  last_used: string;
}

export default function AgentsToolsPage() {
  const [tools] = useState<AgentTool[]>([
    {
      id: '1',
      name: 'File System Access',
      category: 'System',
      enabled: true,
      usage_count: 2847,
      success_rate: 99.2,
      avg_execution_time: 23,
      last_used: '2 minutes ago',
    },
    {
      id: '2',
      name: 'Web Search',
      category: 'External',
      enabled: true,
      usage_count: 1523,
      success_rate: 94.8,
      avg_execution_time: 456,
      last_used: '15 minutes ago',
    },
    {
      id: '3',
      name: 'Code Execution',
      category: 'Development',
      enabled: true,
      usage_count: 934,
      success_rate: 87.3,
      avg_execution_time: 1234,
      last_used: '1 hour ago',
    },
    {
      id: '4',
      name: 'Database Query',
      category: 'Data',
      enabled: false,
      usage_count: 234,
      success_rate: 96.7,
      avg_execution_time: 89,
      last_used: '3 days ago',
    },
  ]);

  const categories = ['All', 'System', 'External', 'Development', 'Data'];
  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredTools = selectedCategory === 'All'
    ? tools
    : tools.filter(tool => tool.category === selectedCategory);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="pb-4 border-b border-border-light">
            <h1 className="text-base font-medium text-gray-900 font-inter">Tools Management</h1>
            <p className="text-gray-600 mt-1 font-inter text-xs">
              Manage agent tool access and monitor usage patterns
            </p>
          </div>
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Tool
          </Button>
        </div>

        <div className="flex gap-2">
          {categories.map(category => (
            <Button
              key={category}
              variant={selectedCategory === category ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className="text-xs"
            >
              {category}
            </Button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {filteredTools.map((tool) => (
            <Card key={tool.id} className="border-border-light shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Wrench className="h-5 w-5 text-gray-900" />
                    <div>
                      <CardTitle className="text-base">{tool.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {tool.category} • {tool.usage_count.toLocaleString()} uses
                      </CardDescription>
                    </div>
                  </div>
                  <Badge className={`${tool.enabled ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-700'} border`}>
                    {tool.enabled ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                    {tool.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-beige-primary border border-border-light rounded-md p-3">
                      <div className="text-xs text-gray-600">Success Rate</div>
                      <div className={`text-sm font-medium ${
                        tool.success_rate > 95 ? 'text-green-600' :
                        tool.success_rate > 85 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {tool.success_rate.toFixed(1)}%
                      </div>
                    </div>
                    <div className="bg-beige-primary border border-border-light rounded-md p-3">
                      <div className="text-xs text-gray-600">Avg Time</div>
                      <div className="text-sm font-medium text-gray-900">{tool.avg_execution_time}ms</div>
                    </div>
                    <div className="bg-beige-primary border border-border-light rounded-md p-3">
                      <div className="text-xs text-gray-600">Last Used</div>
                      <div className="text-xs font-medium text-gray-900">{tool.last_used}</div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant={tool.enabled ? 'destructive' : 'default'}
                      size="sm"
                      className="flex-1 text-xs"
                    >
                      {tool.enabled ? 'Disable' : 'Enable'}
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 text-xs">
                      Configure
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-border-light shadow-sm">
          <CardHeader>
            <CardTitle>Tool Usage Insights</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                <h4 className="text-sm font-medium text-blue-900">Key Insights</h4>
              </div>
              <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                <li>File System Access is most frequently used (2847 calls)</li>
                <li>Code Execution has lowest success rate (87.3%) - may need review</li>
                <li>Database Query tool disabled but still showing high success rate when enabled</li>
                <li>Web Search average execution time increased by 15% this week</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
