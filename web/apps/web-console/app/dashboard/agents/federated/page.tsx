'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  useFederatedStatus,
  useFederatedParticipants,
  useFederatedRounds,
  useFederatedConfig,
  useStartFederatedRound,
  useUpdateFederatedConfig,
} from '@/hooks/useFederated';
import {
  Network, Play, CheckCircle, XCircle, Clock, Activity,
  Shield, Users, RefreshCw, TrendingDown, Cpu,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CHART_COLORS } from '@/utils/constants';
import { useChartTheme } from '@/utils/chartTheme';

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${hrs}h ago`;
}

function statusColor(status: string) {
  switch (status) {
    case 'active':
    case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'uploading':
    case 'aggregating':
    case 'running': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'idle': return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
    case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    default: return 'bg-gray-100 text-gray-600';
  }
}

export default function FederatedLearningPage() {
  const chartTheme = useChartTheme();
  const { data: status, isLoading: statusLoading } = useFederatedStatus();
  const { data: participants, isLoading: participantsLoading } = useFederatedParticipants();
  const { data: rounds, isLoading: roundsLoading } = useFederatedRounds();
  const { data: config } = useFederatedConfig();

  const startRoundMutation = useStartFederatedRound();
  const updateConfigMutation = useUpdateFederatedConfig();

  const [editableConfig, setEditableConfig] = useState({
    enabled: config?.enabled ?? true,
    min_participants: config?.min_participants ?? 3,
    privacy_budget: config?.privacy_budget ?? 1.0,
    noise_scale: config?.noise_scale ?? 0.1,
    round_interval_mins: config?.round_interval_mins ?? 60,
    max_rounds_per_day: config?.max_rounds_per_day ?? 12,
  });
  const [configChanged, setConfigChanged] = useState(false);

  const handleConfigChange = (field: string, value: any) => {
    setEditableConfig(prev => ({ ...prev, [field]: value }));
    setConfigChanged(true);
  };

  const handleSaveConfig = async () => {
    try {
      await updateConfigMutation.mutateAsync(editableConfig);
      setConfigChanged(false);
    } catch {}
  };

  const handleStartRound = async () => {
    try {
      await startRoundMutation.mutateAsync();
    } catch {}
  };

  // Build loss chart data from completed rounds
  const lossChartData = (rounds ?? [])
    .filter(r => r.status === 'completed' && r.aggregation_loss != null)
    .slice()
    .reverse()
    .map(r => ({ round: `R${r.id}`, loss: r.aggregation_loss }));

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-[#f6f6f4]">
              Federated Learning
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Privacy-preserving model training across edge devices using differential privacy
            </p>
          </div>
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={handleStartRound}
            disabled={startRoundMutation.isPending || status?.active_round != null}
          >
            <Play className="h-3.5 w-3.5" />
            {startRoundMutation.isPending ? 'Starting…' : 'Start Round'}
          </Button>
        </div>

        {/* Status cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-blue-500" strokeWidth={1.5} />
                <span className="text-xs text-gray-500 dark:text-gray-400">Active Round</span>
              </div>
              <p className="text-2xl font-semibold text-gray-900 dark:text-[#f6f6f4]">
                {statusLoading ? '—' : status?.active_round != null ? `#${status.active_round}` : 'None'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-green-500" strokeWidth={1.5} />
                <span className="text-xs text-gray-500 dark:text-gray-400">Participants</span>
              </div>
              <p className="text-2xl font-semibold text-gray-900 dark:text-[#f6f6f4]">
                {statusLoading ? '—' : status?.participants ?? 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="h-4 w-4 text-purple-500" strokeWidth={1.5} />
                <span className="text-xs text-gray-500 dark:text-gray-400">Total Rounds</span>
              </div>
              <p className="text-2xl font-semibold text-gray-900 dark:text-[#f6f6f4]">
                {statusLoading ? '—' : status?.total_rounds ?? 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-orange-500" strokeWidth={1.5} />
                <span className="text-xs text-gray-500 dark:text-gray-400">Privacy Budget ε</span>
              </div>
              <p className="text-2xl font-semibold text-gray-900 dark:text-[#f6f6f4]">
                {statusLoading ? '—' : status?.privacy_budget?.toFixed(1) ?? '1.0'}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Participants */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Active Participants</CardTitle>
              <CardDescription className="text-xs">Edge devices currently in the federation</CardDescription>
            </CardHeader>
            <CardContent>
              {participantsLoading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-10 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {(participants ?? []).map(p => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-[#f6f6f4]/10 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Cpu className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
                        <div>
                          <p className="text-xs font-medium text-gray-900 dark:text-[#f6f6f4]">{p.hostname}</p>
                          <p className="text-[10px] text-gray-400">{p.device_id} · {formatRelativeTime(p.last_seen)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400">{p.updates_count} updates</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColor(p.status)}`}>
                          {p.status}
                        </span>
                      </div>
                    </div>
                  ))}
                  {(!participants || participants.length === 0) && (
                    <p className="text-xs text-gray-400 text-center py-4">No participants connected</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Aggregation Loss Chart */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Aggregation Loss</CardTitle>
              <CardDescription className="text-xs">Model loss per completed round</CardDescription>
            </CardHeader>
            <CardContent>
              {lossChartData.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-xs text-gray-400">
                  No completed rounds yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={lossChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                    <XAxis dataKey="round" tick={{ fontSize: 10, fill: chartTheme.text }} />
                    <YAxis tick={{ fontSize: 10, fill: chartTheme.text }} domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{ fontSize: 11, background: chartTheme.tooltipBg, border: `1px solid ${chartTheme.tooltipBorder}` }}
                    />
                    <Line type="monotone" dataKey="loss" stroke={CHART_COLORS.primary} strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Round History */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Round History</CardTitle>
            <CardDescription className="text-xs">Recent aggregation rounds</CardDescription>
          </CardHeader>
          <CardContent>
            {roundsLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-[#f6f6f4]/10">
                      <th className="text-left pb-2 font-medium text-gray-500">Round</th>
                      <th className="text-left pb-2 font-medium text-gray-500">Status</th>
                      <th className="text-left pb-2 font-medium text-gray-500">Participants</th>
                      <th className="text-left pb-2 font-medium text-gray-500">Updates</th>
                      <th className="text-left pb-2 font-medium text-gray-500">Loss</th>
                      <th className="text-left pb-2 font-medium text-gray-500">Model</th>
                      <th className="text-left pb-2 font-medium text-gray-500">Started</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(rounds ?? []).map(r => (
                      <tr key={r.id} className="border-b border-gray-50 dark:border-[#f6f6f4]/5 last:border-0">
                        <td className="py-2 font-medium text-gray-900 dark:text-[#f6f6f4]">#{r.id}</td>
                        <td className="py-2">
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${statusColor(r.status)}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="py-2 text-gray-600 dark:text-gray-400">{r.participant_count}</td>
                        <td className="py-2 text-gray-600 dark:text-gray-400">{r.updates_received}</td>
                        <td className="py-2 text-gray-600 dark:text-gray-400">
                          {r.aggregation_loss != null ? r.aggregation_loss.toFixed(3) : '—'}
                        </td>
                        <td className="py-2 text-gray-600 dark:text-gray-400">{r.model_version}</td>
                        <td className="py-2 text-gray-400">{formatRelativeTime(r.started_at)}</td>
                      </tr>
                    ))}
                    {(!rounds || rounds.length === 0) && (
                      <tr>
                        <td colSpan={7} className="py-4 text-center text-gray-400">No rounds yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Configuration */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium">Configuration</CardTitle>
                <CardDescription className="text-xs">Differential privacy and aggregation settings</CardDescription>
              </div>
              {configChanged && (
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleSaveConfig}
                  disabled={updateConfigMutation.isPending}
                >
                  {updateConfigMutation.isPending ? 'Saving…' : 'Save Changes'}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-medium">Enabled</Label>
                  <p className="text-[10px] text-gray-400 mt-0.5">Enable federated learning coordinator</p>
                </div>
                <Switch
                  checked={editableConfig.enabled}
                  onCheckedChange={v => handleConfigChange('enabled', v)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Min Participants</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={editableConfig.min_participants}
                  onChange={e => handleConfigChange('min_participants', parseInt(e.target.value))}
                  className="h-8 text-xs"
                />
                <p className="text-[10px] text-gray-400">Required before aggregation starts</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Privacy Budget (ε)</Label>
                <Input
                  type="number"
                  min={0.1}
                  max={10}
                  step={0.1}
                  value={editableConfig.privacy_budget}
                  onChange={e => handleConfigChange('privacy_budget', parseFloat(e.target.value))}
                  className="h-8 text-xs"
                />
                <p className="text-[10px] text-gray-400">Lower = more private, more noise</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Noise Scale</Label>
                <Input
                  type="number"
                  min={0.01}
                  max={1}
                  step={0.01}
                  value={editableConfig.noise_scale}
                  onChange={e => handleConfigChange('noise_scale', parseFloat(e.target.value))}
                  className="h-8 text-xs"
                />
                <p className="text-[10px] text-gray-400">Gaussian noise multiplier for DP</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Round Interval (minutes)</Label>
                <Input
                  type="number"
                  min={10}
                  max={1440}
                  value={editableConfig.round_interval_mins}
                  onChange={e => handleConfigChange('round_interval_mins', parseInt(e.target.value))}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Max Rounds / Day</Label>
                <Input
                  type="number"
                  min={1}
                  max={144}
                  value={editableConfig.max_rounds_per_day}
                  onChange={e => handleConfigChange('max_rounds_per_day', parseInt(e.target.value))}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
