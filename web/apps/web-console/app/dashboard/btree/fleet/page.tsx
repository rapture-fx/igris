'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Server, Activity, AlertTriangle, CheckCircle, XCircle, Clock, Search, Filter, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/helpers';

interface AgentStatus {
  agent_id: string;
  status: string;
  last_seen_ms: number;
  tick_rate: number;
  failure_rate: number;
  replan_count: number;
  current_mission?: string;
}

interface FleetOverview {
  total_agents: number;
  healthy_agents: number;
  warning_agents: number;
  critical_agents: number;
  offline_agents: number;
  avg_tick_rate: number;
  total_replans_last_hour: number;
  agents: AgentStatus[];
}

export default function BTreeFleetPage() {
  const [fleetData, setFleetData] = useState<FleetOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const OVERTURE_URL = process.env.NEXT_PUBLIC_OVERTURE_URL || 'http://localhost:8080';

  const fetchFleetData = async () => {
    try {
      const response = await fetch(`${OVERTURE_URL}/api/btree/fleet/overview`);
      if (!response.ok) throw new Error('Failed to fetch fleet data');
      const data = await response.json();
      setFleetData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFleetData();

    if (autoRefresh) {
      const interval = setInterval(fetchFleetData, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const filteredAgents = fleetData?.agents.filter(agent => {
    const matchesSearch = agent.agent_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         agent.current_mission?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || agent.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Healthy</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500"><AlertTriangle className="h-3 w-3 mr-1" />Warning</Badge>;
      case 'critical':
        return <Badge className="bg-red-500"><XCircle className="h-3 w-3 mr-1" />Critical</Badge>;
      case 'offline':
        return <Badge className="bg-gray-500"><Clock className="h-3 w-3 mr-1" />Offline</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatTimeSince = (timestampMs: number) => {
    const seconds = Math.floor((Date.now() - timestampMs) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">BTree Fleet View</h1>
            <p className="text-muted-foreground mt-1">
              Monitor all behavior tree agents across your fleet
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", autoRefresh && "animate-spin")} />
              {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            </Button>
            <Button onClick={fetchFleetData} size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Now
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {fleetData && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
                <Server className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fleetData.total_agents}</div>
                <p className="text-xs text-muted-foreground">Active in fleet</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Healthy Agents</CardTitle>
                <CheckCircle className="h-4 w-4 text-black" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-black">{fleetData.healthy_agents}</div>
                <p className="text-xs text-muted-foreground">
                  {fleetData.total_agents > 0
                    ? Math.round((fleetData.healthy_agents / fleetData.total_agents) * 100)
                    : 0}% of fleet
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Tick Rate</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fleetData.avg_tick_rate.toFixed(1)}</div>
                <p className="text-xs text-muted-foreground">ticks/second</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Replans</CardTitle>
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fleetData.total_replans_last_hour}</div>
                <p className="text-xs text-muted-foreground">Last hour</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Error State */}
        {error && (
          <Card className="border-red-500">
            <CardHeader>
              <CardTitle className="text-red-500 flex items-center gap-2">
                <XCircle className="h-5 w-5" />
                Error Loading Fleet Data
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p>{error}</p>
              <p className="text-sm text-muted-foreground mt-2">
                Make sure Overture server is running at {OVERTURE_URL}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Agents Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Fleet Agents</CardTitle>
                <CardDescription>All registered behavior tree agents</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search agents..."
                    className="pl-8 w-[200px]"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[130px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="healthy">Healthy</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading fleet data...</span>
              </div>
            ) : filteredAgents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No agents found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-medium">Agent ID</th>
                      <th className="text-left p-2 font-medium">Status</th>
                      <th className="text-left p-2 font-medium">Tick Rate</th>
                      <th className="text-left p-2 font-medium">Failure Rate</th>
                      <th className="text-left p-2 font-medium">Replans</th>
                      <th className="text-left p-2 font-medium">Current Mission</th>
                      <th className="text-left p-2 font-medium">Last Seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAgents.map((agent) => (
                      <tr key={agent.agent_id} className="border-b hover:bg-muted/50">
                        <td className="p-2 font-mono text-sm">{agent.agent_id}</td>
                        <td className="p-2">{getStatusBadge(agent.status)}</td>
                        <td className="p-2">{agent.tick_rate.toFixed(1)} tps</td>
                        <td className="p-2">
                          <span className={cn(
                            agent.failure_rate > 0.5 ? 'text-red-500' :
                            agent.failure_rate > 0.2 ? 'text-yellow-500' :
                            'text-black'
                          )}>
                            {(agent.failure_rate * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td className="p-2">{agent.replan_count}</td>
                        <td className="p-2 text-sm text-muted-foreground">
                          {agent.current_mission || '—'}
                        </td>
                        <td className="p-2 text-sm text-muted-foreground">
                          {formatTimeSince(agent.last_seen_ms)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
