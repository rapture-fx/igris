'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, Play, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';

interface TrainingJob {
  id: string;
  model_name: string;
  base_model: string;
  status: 'running' | 'completed' | 'failed' | 'queued';
  progress: number;
  epochs_completed: number;
  epochs_total: number;
  loss: number;
  learning_rate: number;
  started_at: string;
  estimated_completion?: string;
}

export default function AgentsQLoRAPage() {
  const [jobs] = useState<TrainingJob[]>([
    {
      id: 'job-1',
      model_name: 'custom-agent-v3',
      base_model: 'llama-3-8b',
      status: 'running',
      progress: 67,
      epochs_completed: 2,
      epochs_total: 3,
      loss: 0.234,
      learning_rate: 0.0001,
      started_at: '2 hours ago',
      estimated_completion: '45 minutes',
    },
    {
      id: 'job-2',
      model_name: 'domain-specialist-v1',
      base_model: 'mistral-7b',
      status: 'completed',
      progress: 100,
      epochs_completed: 5,
      epochs_total: 5,
      loss: 0.156,
      learning_rate: 0.00005,
      started_at: '1 day ago',
    },
    {
      id: 'job-3',
      model_name: 'code-assistant-v2',
      base_model: 'codellama-13b',
      status: 'queued',
      progress: 0,
      epochs_completed: 0,
      epochs_total: 4,
      loss: 0,
      learning_rate: 0.0002,
      started_at: '—',
    },
  ]);

  const getStatusBadge = (status: TrainingJob['status']) => {
    const config = {
      running: { icon: Clock },
      completed: { icon: CheckCircle },
      failed: { icon: XCircle },
      queued: { icon: Clock },
    };
    const { icon: Icon } = config[status];
    return (
      <Badge className="bg-gray-50 text-gray-700 border flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="pb-4 border-b border-border-light">
            <h1 className="text-base font-medium text-gray-900 font-inter">QLoRA Training</h1>
            <p className="text-gray-600 mt-1 font-inter text-xs">
              Train and fine-tune models using Quantized Low-Rank Adaptation
            </p>
          </div>
          <Button variant="outline" className="shadow-sm flex items-center gap-2">
            <Play className="h-4 w-4" />
            Start Training
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Jobs</CardTitle>
              <GraduationCap className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">24</div>
              <p className="text-xs text-gray-600 mt-1">Last 30 days</p>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Success Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">91.7%</div>
              <div className="flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3 text-gray-600" />
                <span className="text-xs text-gray-600">22/24 completed</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Avg Training Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">3.2h</div>
              <p className="text-xs text-gray-600 mt-1">Per job</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {jobs.map((job) => (
            <Card key={job.id} className="border-border-light shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <GraduationCap className="h-5 w-5 text-gray-900" />
                    <div>
                      <CardTitle className="text-sm text-base">{job.model_name}</CardTitle>
                      <CardDescription className="text-xs mt-1">
                        Base: {job.base_model} • Started {job.started_at}
                      </CardDescription>
                    </div>
                  </div>
                  {getStatusBadge(job.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {job.status === 'running' && (
                    <div className="bg-beige-primary border border-border-light rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-900">Training Progress</span>
                        <span className="text-sm text-gray-600">
                          Epoch {job.epochs_completed}/{job.epochs_total}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                        <div
                          className="bg-gray-900 h-2 rounded-full"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-600">
                        Estimated completion: {job.estimated_completion}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-beige-primary border border-border-light rounded-md p-3">
                      <div className="text-xs text-gray-600">Loss</div>
                      <div className={`text-sm font-medium ${
                        job.loss < 0.2 ? 'text-gray-600' :
                        job.loss < 0.5 ? 'text-gray-600' :
                        'text-gray-900'
                      }`}>
                        {job.loss.toFixed(3)}
                      </div>
                    </div>
                    <div className="bg-beige-primary border border-border-light rounded-md p-3">
                      <div className="text-xs text-gray-600">Learning Rate</div>
                      <div className="text-sm font-medium text-gray-900">
                        {job.learning_rate.toExponential(1)}
                      </div>
                    </div>
                    <div className="bg-beige-primary border border-border-light rounded-md p-3">
                      <div className="text-xs text-gray-600">Epochs</div>
                      <div className="text-sm font-medium text-gray-900">
                        {job.epochs_completed}/{job.epochs_total}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {job.status === 'running' && (
                      <>
                        <Button variant="outline" size="sm" className="flex-1 text-xs">
                          View Logs
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1 text-xs">
                          Stop
                        </Button>
                      </>
                    )}
                    {job.status === 'completed' && (
                      <>
                        <Button variant="outline" size="sm" className="flex-1 text-xs">
                          Download
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1 text-xs">
                          Deploy
                        </Button>
                      </>
                    )}
                    {job.status === 'queued' && (
                      <Button variant="outline" size="sm" className="w-full text-xs">
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
