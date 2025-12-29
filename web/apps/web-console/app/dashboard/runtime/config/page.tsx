'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sliders, Send, CheckCircle, Clock, XCircle } from 'lucide-react';

interface ConfigPush {
  id: string;
  name: string;
  target: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  created_at: string;
  completed_at?: string;
  devices_targeted: number;
  devices_completed: number;
}

export default function RuntimeConfigPage() {
  const [configPushes] = useState<ConfigPush[]>([
    {
      id: '1',
      name: 'Model Update - GPT-4 Turbo',
      target: 'all-us-east',
      status: 'completed',
      created_at: '2 hours ago',
      completed_at: '1 hour ago',
      devices_targeted: 12,
      devices_completed: 12,
    },
    {
      id: '2',
      name: 'Security Patch v2.1.4',
      target: 'all-regions',
      status: 'in_progress',
      created_at: '15 minutes ago',
      devices_targeted: 24,
      devices_completed: 18,
    },
    {
      id: '3',
      name: 'Cache Configuration',
      target: 'eu-west',
      status: 'pending',
      created_at: '5 minutes ago',
      devices_targeted: 6,
      devices_completed: 0,
    },
  ]);

  const getStatusBadge = (status: ConfigPush['status']) => {
    const config = {
      pending: { bg: 'bg-blue-50', text: 'text-blue-700', icon: Clock },
      in_progress: { bg: 'bg-yellow-50', text: 'text-yellow-700', icon: Clock },
      completed: { bg: 'bg-green-50', text: 'text-green-700', icon: CheckCircle },
      failed: { bg: 'bg-red-50', text: 'text-red-700', icon: XCircle },
    };
    const { bg, text, icon: Icon } = config[status];
    return (
      <Badge className={`${bg} ${text} border flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-medium text-gray-900 font-inter">Config Push</h1>
            <p className="text-gray-600 mt-1 font-inter">
              Deploy configuration updates to runtime instances
            </p>
          </div>
          <Button className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            New Config Push
          </Button>
        </div>

        <div className="space-y-4">
          {configPushes.map((push) => (
            <Card key={push.id} className="border-border-light shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Sliders className="h-5 w-5 text-gray-900" />
                    <div>
                      <CardTitle className="text-base">{push.name}</CardTitle>
                      <CardDescription className="mt-1">
                        Target: {push.target} • Created {push.created_at}
                      </CardDescription>
                    </div>
                  </div>
                  {getStatusBadge(push.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-beige-primary border border-border-light rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">Progress</span>
                      <span className="text-sm text-gray-600">
                        {push.devices_completed}/{push.devices_targeted} devices
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          push.status === 'completed' ? 'bg-green-500' :
                          push.status === 'failed' ? 'bg-red-500' :
                          push.status === 'in_progress' ? 'bg-yellow-500' :
                          'bg-blue-500'
                        }`}
                        style={{ width: `${(push.devices_completed / push.devices_targeted) * 100}%` }}
                      />
                    </div>
                  </div>

                  {push.completed_at && (
                    <div className="text-xs text-gray-600">
                      Completed {push.completed_at}
                    </div>
                  )}

                  <div className="flex gap-2">
                    {push.status === 'pending' && (
                      <>
                        <Button variant="outline" size="sm" className="flex-1 text-xs">
                          Cancel
                        </Button>
                        <Button size="sm" className="flex-1 text-xs">
                          <Send className="h-3 w-3 mr-1" />
                          Deploy Now
                        </Button>
                      </>
                    )}
                    {push.status === 'in_progress' && (
                      <Button variant="destructive" size="sm" className="flex-1 text-xs">
                        Stop Deployment
                      </Button>
                    )}
                    {(push.status === 'completed' || push.status === 'failed') && (
                      <Button variant="outline" size="sm" className="flex-1 text-xs">
                        View Details
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
