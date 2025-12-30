'use client';

export const dynamic = 'force-dynamic';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Radio, Activity, Zap, Users, TrendingUp } from 'lucide-react';

export default function RuntimeSwarmPage() {
  const swarmMetrics = {
    total_nodes: 24,
    active_connections: 276,
    consensus_health: 98.7,
    avg_sync_latency: 45,
    messages_per_second: 1847,
    partition_tolerance: 'healthy',
  };

  const nodes = [
    { id: 'node-1', region: 'us-east-1', connections: 23, status: 'leader', health: 99.2 },
    { id: 'node-2', region: 'us-west-2', connections: 22, status: 'follower', health: 98.5 },
    { id: 'node-3', region: 'eu-west-1', connections: 21, status: 'follower', health: 97.8 },
    { id: 'node-4', region: 'ap-south-1', connections: 20, status: 'follower', health: 99.1 },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="pb-4 border-b border-border-light">
          <h1 className="text-base font-medium text-gray-900 font-inter">Swarm Status</h1>
          <p className="text-gray-600 mt-1 font-inter text-xs">
            Monitor distributed consensus and node coordination
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Nodes</CardTitle>
              <Radio className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-gray-900">{swarmMetrics.total_nodes}</div>
              <p className="text-xs text-gray-600 mt-1">{swarmMetrics.active_connections} active connections</p>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Consensus Health</CardTitle>
              <Activity className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-gray-900">{swarmMetrics.consensus_health}%</div>
              <div className="flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3 text-gray-600" />
                <span className="text-xs text-gray-600">Excellent</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Sync Latency</CardTitle>
              <Zap className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-gray-900">{swarmMetrics.avg_sync_latency}ms</div>
              <p className="text-xs text-gray-600 mt-1">Average across swarm</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border-light shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-gray-900" />
              <CardTitle className="text-sm">Swarm Nodes</CardTitle>
            </div>
            <CardDescription className="text-xs">Distributed consensus network</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {nodes.map((node) => (
                <div key={node.id} className="bg-beige-primary border border-border-light rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="font-medium text-gray-900">{node.id}</div>
                      <Badge className={`${node.status === 'leader' ? 'bg-gray-50 text-gray-700' : 'bg-gray-50 text-gray-700'} border text-xs`}>
                        {node.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-900 font-medium">{node.health}% healthy</div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Region: </span>
                      <span className="text-gray-900">{node.region.toUpperCase()}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Connections: </span>
                      <span className="text-gray-900">{node.connections}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border-light shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">Partition Tolerance</CardTitle>
            <CardDescription className="text-xs">Network resilience and fault tolerance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <Activity className="h-4 w-4 text-gray-600" />
                <h4 className="text-sm font-medium text-gray-900">Healthy State</h4>
              </div>
              <ul className="text-xs text-gray-800 space-y-1 list-disc list-inside">
                <li>All nodes can reach consensus within 45ms</li>
                <li>No network partitions detected in last 7 days</li>
                <li>Automatic failover tested and operational</li>
                <li>CAP theorem: Prioritizing Consistency + Partition tolerance</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
