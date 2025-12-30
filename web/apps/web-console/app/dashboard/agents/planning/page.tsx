'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Brain, Play, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function AgentsPlanningPage() {
  const [testResults] = useState([
    {
      id: '1',
      task: 'Multi-step API integration',
      status: 'completed',
      planning_time: 234,
      execution_time: 1456,
      reflection_score: 8.7,
      steps_planned: 12,
      steps_executed: 12,
      timestamp: '2 hours ago',
    },
    {
      id: '2',
      task: 'Complex data transformation',
      status: 'in_progress',
      planning_time: 189,
      execution_time: null,
      reflection_score: null,
      steps_planned: 8,
      steps_executed: 5,
      timestamp: '15 minutes ago',
    },
  ]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="pb-4 border-b border-border-light">
            <h1 className="text-base font-medium text-gray-900 font-inter">Planning & Reflection</h1>
            <p className="text-gray-600 mt-1 font-inter text-xs">
              Test agent reasoning, planning, and self-reflection capabilities
            </p>
          </div>
          <Button variant="outline" className="shadow-sm flex items-center gap-2">
            <Play className="h-4 w-4" />
            New Test
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Tests Run</CardTitle>
              <Brain className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-gray-900">147</div>
              <p className="text-xs text-gray-600 mt-1">Last 30 days</p>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Avg Reflection Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-gray-900">8.4/10</div>
              <p className="text-xs text-gray-600 mt-1">+0.3 from last week</p>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Success Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-gray-900">94.2%</div>
              <p className="text-xs text-gray-600 mt-1">142/147 tests passed</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {testResults.map((test) => (
            <Card key={test.id} className="border-border-light shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Brain className="h-4 w-4 text-gray-900" />
                    <div>
                      <CardTitle className="text-sm">{test.task}</CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {test.timestamp}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {test.status === 'completed' ? (
                      <CheckCircle className="h-4 w-4 text-gray-600" />
                    ) : test.status === 'in_progress' ? (
                      <Clock className="h-4 w-4 text-gray-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-gray-600" />
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-beige-primary border border-border-light rounded-lg p-3">
                      <div className="text-xs text-gray-600 mb-1">Planning</div>
                      <div className="text-sm font-medium text-gray-900">{test.planning_time}ms</div>
                    </div>
                    <div className="bg-beige-primary border border-border-light rounded-lg p-3">
                      <div className="text-xs text-gray-600 mb-1">Execution</div>
                      <div className="text-sm font-medium text-gray-900">
                        {test.execution_time ? `${test.execution_time}ms` : '—'}
                      </div>
                    </div>
                    <div className="bg-beige-primary border border-border-light rounded-lg p-3">
                      <div className="text-xs text-gray-600 mb-1">Reflection</div>
                      <div className="text-sm font-medium text-gray-900">
                        {test.reflection_score ? `${test.reflection_score}/10` : '—'}
                      </div>
                    </div>
                    <div className="bg-beige-primary border border-border-light rounded-lg p-3">
                      <div className="text-xs text-gray-600 mb-1">Steps</div>
                      <div className="text-sm font-medium text-gray-900">
                        {test.steps_executed}/{test.steps_planned}
                      </div>
                    </div>
                  </div>

                  {test.status === 'in_progress' && (
                    <div className="bg-beige-primary border border-border-light rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-900">Progress</span>
                        <span className="text-sm text-gray-600">
                          Step {test.steps_executed}/{test.steps_planned}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-gray-900 h-2 rounded-full"
                          style={{ width: `${(test.steps_executed / test.steps_planned) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <Button variant="outline" size="sm" className="w-full text-xs">
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
