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
import { useChartTheme } from '@/utils/chartTheme';
import {
  useCouncilStatus,
  useCouncilConfig,
  useCouncilAnalytics,
  useCouncilHistory,
  useUpdateCouncilConfig,
  useTestCouncil,
} from '@/hooks/useCouncil';
import {
  Users,
  TrendingUp,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  Settings,
  Play,
  RotateCcw,
  History,
  BarChart3,
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, ScatterChart, Scatter, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { CHART_COLORS } from '@/utils/constants';

const sliderStyles = `
  input[type="range"].dark-blue-slider {
    accent-color: #114dcd;
  }
  input[type="range"].dark-blue-slider:hover,
  input[type="range"].dark-blue-slider:active,
  input[type="range"].dark-blue-slider:focus {
    accent-color: #114dcd;
    outline: none;
  }
  .hide-scrollbar {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .hide-scrollbar::-webkit-scrollbar {
    display: none;
  }
`;

const AVAILABLE_MODELS = [
  'gpt-4',
  'gpt-4-turbo',
  'claude-3-opus',
  'claude-3-sonnet',
  'gemini-pro',
  'gemini-ultra',
  'grok-2',
  'llama-3-70b',
];

const renderCustomPieLabel = ({ cx, cy, midAngle, outerRadius, model, win_rate }: any) => {
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 20;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#374151"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      style={{ fontSize: '8px', fontFamily: 'Inter, sans-serif' }}
    >
      {`${model}: ${win_rate.toFixed(1)}%`}
    </text>
  );
};

export default function CouncilModePage() {
  const chartTheme = useChartTheme();
  const { data: status } = useCouncilStatus();
  const { data: config } = useCouncilConfig();
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');
  const { data: analytics } = useCouncilAnalytics(timeRange);
  const { data: history } = useCouncilHistory(20);

  const updateConfigMutation = useUpdateCouncilConfig();
  const testCouncilMutation = useTestCouncil();

  const [editableConfig, setEditableConfig] = useState({
    enabled: config?.enabled ?? true,
    num_models: config?.num_models ?? 3,
    models: config?.models ?? ['gpt-4', 'claude-3-opus', 'gemini-pro'],
    voting_strategy: config?.voting_strategy ?? 'majority',
    quality_threshold: config?.quality_threshold ?? 85,
    max_tokens: config?.max_tokens ?? 2000,
    cost_limit: config?.cost_limit ?? 0.5,
    chairman_model: config?.chairman_model,
  });

  const [configChanged, setConfigChanged] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [testPrompt, setTestPrompt] = useState('What is the capital of France?');

  const handleConfigChange = (field: string, value: any) => {
    setEditableConfig(prev => ({ ...prev, [field]: value }));
    setConfigChanged(true);
  };

  const handleModelToggle = (model: string) => {
    const currentModels = editableConfig.models;
    if (currentModels.includes(model)) {
      if (currentModels.length > 2) {
        handleConfigChange('models', currentModels.filter(m => m !== model));
      }
    } else {
      if (currentModels.length < 5) {
        handleConfigChange('models', [...currentModels, model]);
      }
    }
  };

  const handleSaveConfig = async () => {
    try {
      await updateConfigMutation.mutateAsync(editableConfig as any);
      alert('Configuration saved successfully');
      setConfigChanged(false);
    } catch (error) {
      alert('Error saving configuration');
    }
  };

  const handleTestCouncil = async () => {
    if (!testPrompt.trim()) {
      alert('Please enter a test prompt');
      return;
    }
    try {
      await testCouncilMutation.mutateAsync(testPrompt);
      alert('Test council run initiated successfully');
      setTestPrompt('');
    } catch (error) {
      alert('Error running test council');
    }
  };

  const PIE_COLORS = [CHART_COLORS.primary, CHART_COLORS.secondary, CHART_COLORS.tertiary, CHART_COLORS.warning, CHART_COLORS.success];
  const SCATTER_COLORS = ['#114dcd', '#299a93', '#1f53d0', '#f59e0b', '#10b981'];

  return (
    <DashboardLayout>
      <style>{sliderStyles}</style>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="pb-4 border-b border-border">
          <h1 className="text-base font-medium text-foreground font-inter">Council Mode</h1>
          <p className="text-muted-foreground mt-1 font-inter text-xs">
            Multi-model consensus with voting for complex queries
          </p>
        </div>

        {/* Overview Metrics */}
        <div className="bg-card">
          <div className="grid grid-cols-3 divide-x divide-border-light">
            <div className="p-4">
              <div className="text-xs font-medium text-muted-foreground mb-1">Status</div>
              <div className="pb-2">
                <Badge className={status?.enabled ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-900' : 'bg-gray-50 text-gray-700 border dark:bg-card dark:text-[#a8a898] dark:border-[#f6f6f4]/5'}>
                  {status?.enabled ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                  {status?.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
            </div>
            <div className="p-4">
              <div className="text-xs font-medium text-muted-foreground mb-1">Council Size</div>
              <div className="text-lg font-bold text-foreground">{status?.current_council_size}</div>
              <p className="text-[0.65rem] text-muted-foreground mt-1">models</p>
            </div>
            <div className="p-4">
              <div className="text-xs font-medium text-muted-foreground mb-1">Quality Improvement</div>
              <div className="text-lg font-bold text-foreground">+{status?.avg_quality_improvement.toFixed(1)}%</div>
              <p className="text-[0.65rem] text-muted-foreground mt-1">vs single model</p>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-border-light border-t border-border">
            <div className="p-4">
              <div className="text-xs font-medium text-muted-foreground mb-1">Cost Overhead</div>
              <div className="text-lg font-bold text-foreground">{status?.cost_overhead_24h.toFixed(1)}x</div>
              <p className="text-[0.65rem] text-muted-foreground mt-1">24h average</p>
            </div>
            <div className="p-4">
              <div className="text-xs font-medium text-muted-foreground mb-1">Last Run</div>
              <div className="text-xs font-bold text-foreground">
                {status?.last_run ? new Date(status.last_run.timestamp).toLocaleTimeString() : 'Never'}
              </div>
              <p className="text-[0.65rem] text-muted-foreground mt-1 truncate">{status?.last_run?.summary || 'No runs yet'}</p>
            </div>
            <div className="p-4"></div>
          </div>
        </div>

        {/* Configuration Form */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Configuration</CardTitle>
            <CardDescription className="text-xs">Configure Council Mode settings and parameters</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="enabled" className="text-xs font-medium text-foreground">Enable Council Mode</Label>
                    <Switch
                      id="enabled"
                      checked={editableConfig.enabled}
                      onCheckedChange={(checked) => handleConfigChange('enabled', checked)}
                      className="scale-50"
                    />
                  </div>
                  <p className="text-[0.6rem] text-muted-foreground">Activate multi-model consensus</p>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="num_models" className="text-xs font-medium text-foreground">
                    Number of Models ({editableConfig.num_models})
                  </Label>
                  <Input
                    id="num_models"
                    type="range"
                    min="2"
                    max="5"
                    value={editableConfig.num_models}
                    onChange={(e) => handleConfigChange('num_models', parseInt(e.target.value))}
                    className="scale-[0.6] origin-left dark-blue-slider h-px"
                  />
                  <p className="text-[0.6rem] text-muted-foreground">Models to participate in voting</p>
                </div>

                <div className="space-y-1 col-span-2">
                  <Label className="text-xs font-medium text-foreground">Model Selection</Label>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_MODELS.map((model) => (
                      <button
                        key={model}
                        onClick={() => handleModelToggle(model)}
                        className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                          editableConfig.models.includes(model)
                            ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-900'
                            : 'bg-card text-foreground border-border hover:bg-muted'
                        }`}
                      >
                        {model}
                      </button>
                    ))}
                  </div>
                  <p className="text-[0.6rem] text-muted-foreground">Select 2-5 models for council</p>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="voting_strategy" className="text-xs font-medium text-foreground">Voting Strategy</Label>
                  <select
                    id="voting_strategy"
                    value={editableConfig.voting_strategy}
                    onChange={(e) => handleConfigChange('voting_strategy', e.target.value)}
                    className="w-full text-xs h-7 border border-border rounded-lg px-2 bg-card"
                  >
                    <option value="majority">Majority</option>
                    <option value="weighted">Weighted</option>
                    <option value="chairman-led">Chairman-Led</option>
                  </select>
                  <p className="text-[0.6rem] text-muted-foreground">How to determine final response</p>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="quality_threshold" className="text-xs font-medium text-foreground">
                    Quality Threshold ({editableConfig.quality_threshold}%)
                  </Label>
                  <Input
                    id="quality_threshold"
                    type="range"
                    min="50"
                    max="99"
                    value={editableConfig.quality_threshold}
                    onChange={(e) => handleConfigChange('quality_threshold', parseInt(e.target.value))}
                    className="scale-[0.6] origin-left dark-blue-slider h-px"
                  />
                  <p className="text-[0.6rem] text-muted-foreground">Minimum quality score to accept</p>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="max_tokens" className="text-xs font-medium text-foreground">Max Tokens</Label>
                  <Input
                    id="max_tokens"
                    type="number"
                    value={editableConfig.max_tokens}
                    onChange={(e) => handleConfigChange('max_tokens', parseInt(e.target.value))}
                    className="text-xs h-7"
                    min="100"
                    max="10000"
                  />
                  <p className="text-[0.6rem] text-muted-foreground">Maximum tokens per response</p>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="cost_limit" className="text-xs font-medium text-foreground">Cost Limit ($)</Label>
                  <Input
                    id="cost_limit"
                    type="number"
                    step="0.01"
                    value={editableConfig.cost_limit}
                    onChange={(e) => handleConfigChange('cost_limit', parseFloat(e.target.value))}
                    className="text-xs h-7"
                    min="0.01"
                    max="10"
                  />
                  <p className="text-[0.6rem] text-muted-foreground">Maximum cost per council run</p>
                </div>

                {editableConfig.voting_strategy === 'chairman-led' && (
                  <div className="space-y-1 col-span-2">
                    <Label htmlFor="chairman_model" className="text-xs font-medium text-foreground">Chairman Model</Label>
                    <select
                      id="chairman_model"
                      value={editableConfig.chairman_model || ''}
                      onChange={(e) => handleConfigChange('chairman_model', e.target.value)}
                      className="w-full text-xs h-7 border border-border rounded-lg px-2 bg-card"
                    >
                      <option value="">Select chairman model</option>
                      {editableConfig.models.map((model) => (
                        <option key={model} value={model}>{model}</option>
                      ))}
                    </select>
                    <p className="text-[0.6rem] text-muted-foreground">Model that makes final decision in case of tie</p>
                  </div>
                )}
              </div>

              {configChanged && (
                <Button
                  onClick={handleSaveConfig}
                  disabled={updateConfigMutation.isPending}
                  variant="outline"
                  className="text-xs shadow-sm h-7 px-3"
                  size="sm"
                >
                  {updateConfigMutation.isPending ? 'Saving...' : 'Save Configuration'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Performance Comparison */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">Performance Comparison</CardTitle>
                <CardDescription className="text-xs">Council vs single model performance metrics</CardDescription>
              </div>
              <div className="flex gap-2">
                {['24h', '7d', '30d'].map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range as any)}
                    className={`px-2 py-1 text-xs rounded-lg border transition-colors ${
                      timeRange === range
                        ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-900'
                        : 'bg-card text-foreground border-border hover:bg-muted'
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              {/* Quality Delta Chart */}
              <div>
                <h4 className="text-xs font-medium text-foreground mb-3">Quality: Council vs Single Model</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={analytics?.quality_delta || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                    <XAxis dataKey="timestamp" tick={{ fontSize: 8 }} tickFormatter={(value) => new Date(value).toLocaleTimeString()} />
                    <YAxis tick={{ fontSize: 8 }} />
                    <Tooltip
                      contentStyle={{ fontSize: '9px', backgroundColor: chartTheme.tooltip.bg, borderRadius: '6px', border: `1px solid ${chartTheme.tooltip.border}`, color: chartTheme.tooltip.text }}
                      labelFormatter={(value) => new Date(value).toLocaleString()}
                      formatter={(value: any) => value.toFixed(1)}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line type="monotone" dataKey="council" stroke={chartTheme.line} strokeWidth={0.5} name="Council" dot={false} />
                    <Line type="monotone" dataKey="single" stroke={CHART_COLORS.gray} strokeWidth={0.5} name="Single" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Latency Overhead Chart */}
              <div>
                <h4 className="text-xs font-medium text-foreground mb-3">Latency by Model Count</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={analytics?.latency_overhead || []}>
                    <defs>
                      <pattern id="barStripe" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(45)">
                        <rect width="2" height="3" fill="#299a93" />
                        <rect x="2" width="1" height="3" fill="#ffffff" />
                      </pattern>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                    <XAxis dataKey="model_count" tick={{ fontSize: 8 }} label={{ value: 'Models', fontSize: 8, position: 'insideBottom', offset: -5 }} />
                    <YAxis tick={{ fontSize: 8 }} label={{ value: 'Latency (ms)', fontSize: 8, angle: -90, position: 'insideLeft' }} />
                    <Tooltip
                      contentStyle={{ fontSize: '9px', backgroundColor: chartTheme.tooltip.bg, borderRadius: '6px', border: `1px solid ${chartTheme.tooltip.border}`, color: chartTheme.tooltip.text }}
                      formatter={(value: any) => `${value.toFixed(0)}ms`}
                    />
                    <Bar dataKey="avg_latency_ms" fill="url(#barStripe)" name="Avg Latency" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Cost vs Quality Scatter */}
              <div>
                <h4 className="text-xs font-medium text-foreground mb-3">Cost vs Quality Trade-off</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                    <XAxis
                      dataKey="cost"
                      type="number"
                      tick={{ fontSize: 8 }}
                      label={{ value: 'Cost ($)', fontSize: 8, position: 'insideBottom', offset: -5 }}
                      domain={[0, 'auto']}
                      tickFormatter={(value) => `$${value.toFixed(2)}`}
                    />
                    <YAxis
                      dataKey="quality"
                      type="number"
                      tick={{ fontSize: 8 }}
                      label={{ value: 'Quality Score', fontSize: 8, angle: -90, position: 'insideLeft' }}
                      domain={[60, 100]}
                      tickFormatter={(value) => value.toFixed(0)}
                    />
                    <Tooltip
                      contentStyle={{ fontSize: '9px', backgroundColor: chartTheme.tooltip.bg, borderRadius: '6px', border: `1px solid ${chartTheme.tooltip.border}`, color: chartTheme.tooltip.text }}
                      cursor={{ strokeDasharray: '3 3' }}
                      formatter={(value: any, name: string) => {
                        if (name === 'cost') return `$${value.toFixed(3)}`;
                        if (name === 'quality') return value.toFixed(1);
                        return value;
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '7px', paddingTop: '10px' }}
                      iconSize={6}
                      verticalAlign="bottom"
                      payload={[
                        { value: '2 Models', type: 'circle', color: SCATTER_COLORS[0] },
                        { value: '3 Models', type: 'circle', color: SCATTER_COLORS[1] },
                        { value: '4 Models', type: 'circle', color: SCATTER_COLORS[2] },
                        { value: '5 Models', type: 'circle', color: SCATTER_COLORS[3] },
                      ]}
                    />
                    <Scatter
                      name="Council Runs"
                      data={analytics?.cost_quality_tradeoff || []}
                      isAnimationActive={false}
                      shape={(props: any) => {
                        const { cx, cy, fill } = props;
                        return <circle cx={cx} cy={cy} r={3} fill={fill} />;
                      }}
                    >
                      {analytics?.cost_quality_tradeoff?.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={SCATTER_COLORS[(entry.model_count - 2) % SCATTER_COLORS.length]} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              {/* Model Win Rate Pie */}
              <div>
                <h4 className="text-xs font-medium text-foreground mb-3">Model Win Rate</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <defs>
                      <pattern id="pieStripe0" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(45)">
                        <rect width="2" height="3" fill="#114dcd" />
                        <rect x="2" width="1" height="3" fill="#ffffff" />
                      </pattern>
                      <pattern id="pieStripe1" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(45)">
                        <rect width="2" height="3" fill="#299a93" />
                        <rect x="2" width="1" height="3" fill="#ffffff" />
                      </pattern>
                      <pattern id="pieStripe2" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(45)">
                        <rect width="2" height="3" fill="#1f53d0" />
                        <rect x="2" width="1" height="3" fill="#ffffff" />
                      </pattern>
                      <pattern id="pieStripe3" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(45)">
                        <rect width="2" height="3" fill="#f59e0b" />
                        <rect x="2" width="1" height="3" fill="#ffffff" />
                      </pattern>
                      <pattern id="pieStripe4" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(45)">
                        <rect width="2" height="3" fill="#10b981" />
                        <rect x="2" width="1" height="3" fill="#ffffff" />
                      </pattern>
                    </defs>
                    <Pie
                      data={analytics?.model_win_rate || []}
                      dataKey="win_rate"
                      nameKey="model"
                      cx="50%"
                      cy="50%"
                      outerRadius={60}
                      label={renderCustomPieLabel}
                      labelLine={false}
                    >
                      {analytics?.model_win_rate?.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={`url(#pieStripe${index % PIE_COLORS.length})`} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontSize: '9px', backgroundColor: chartTheme.tooltip.bg, borderRadius: '6px', border: `1px solid ${chartTheme.tooltip.border}`, color: chartTheme.tooltip.text }}
                      formatter={(value: any) => `${value.toFixed(1)}%`}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Council Runs */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">Recent Council Runs</CardTitle>
            <CardDescription className="text-xs">History of council executions and outcomes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto max-h-96 hide-scrollbar">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Timestamp</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Request ID</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Models</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Outcome</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Quality (C/S)</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Cost Δ</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Latency Δ</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody>
                  {history?.map((entry) => (
                    <>
                      <tr
                        key={entry.id}
                        className="border-b border-gray-100 hover:bg-muted cursor-pointer"
                        onClick={() => setExpandedRow(expandedRow === entry.id ? null : entry.id)}
                      >
                        <td className="py-2 px-3 text-foreground">
                          {new Date(entry.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-foreground font-mono">{entry.request_id}</td>
                        <td className="py-2 px-3 text-foreground">{entry.models_used.length} models</td>
                        <td className="py-2 px-3">
                          <Badge className="bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-900 text-[0.65rem]">
                            {entry.vote_outcome}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-foreground">
                          {entry.quality_score_council.toFixed(1)} / {entry.quality_score_single.toFixed(1)}
                        </td>
                        <td className="py-2 px-3 text-red-600 font-medium">
                          +${entry.cost_delta.toFixed(3)}
                        </td>
                        <td className="py-2 px-3 text-red-600 font-medium">
                          +{entry.latency_delta.toFixed(0)}ms
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {expandedRow === entry.id ? '▼' : '▶'}
                        </td>
                      </tr>
                      {expandedRow === entry.id && (
                        <tr className="bg-muted">
                          <td colSpan={8} className="py-3 px-3">
                            <div className="space-y-2">
                              <div>
                                <span className="text-muted-foreground font-medium">Models Used:</span>
                                <div className="flex gap-2 mt-1 flex-wrap">
                                  {entry.models_used.map((model) => (
                                    <Badge key={model} className="bg-gray-50 text-gray-700 border dark:bg-card dark:text-[#a8a898] dark:border-[#f6f6f4]/5 text-[0.65rem]">
                                      {model}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              {entry.full_response && (
                                <div>
                                  <span className="text-muted-foreground font-medium">Full Response:</span>
                                  <p className="mt-1 text-foreground text-xs bg-card p-2 rounded border border-border">
                                    {entry.full_response}
                                  </p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
              {(!history || history.length === 0) && (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  No council runs yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">Actions</CardTitle>
            <CardDescription className="text-xs">Test and manage Council Mode</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="test_prompt" className="text-xs font-medium text-foreground">Test Council with Sample Prompt</Label>
                <div className="flex gap-2">
                  <Input
                    id="test_prompt"
                    value={testPrompt}
                    onChange={(e) => setTestPrompt(e.target.value)}
                    placeholder="Enter a test prompt..."
                    className="text-xs h-8 max-w-md"
                  />
                  <Button
                    onClick={handleTestCouncil}
                    disabled={testCouncilMutation.isPending}
                    variant="outline"
                    className="text-xs h-7 px-2 whitespace-nowrap"
                    size="sm"
                  >
                    <Play className="h-3 w-3 mr-1" />
                    {testCouncilMutation.isPending ? 'Running...' : 'Run Test'}
                  </Button>
                </div>
                <p className="text-[0.6rem] text-muted-foreground">Run a test council query to see multi-model consensus in action</p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="text-xs h-8 px-3"
                  size="sm"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reset Stats
                </Button>
                <Button
                  variant="outline"
                  className="text-xs h-8 px-3"
                  size="sm"
                >
                  <History className="h-3 w-3 mr-1" />
                  View Full History
                </Button>
                <Button
                  variant="outline"
                  className="text-xs h-8 px-3"
                  size="sm"
                >
                  <BarChart3 className="h-3 w-3 mr-1" />
                  Export Analytics
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* How Council Mode Works */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">How Council Mode Works</CardTitle>
            <CardDescription className="text-xs">Multi-model consensus for better responses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs text-foreground mb-2">
                Council Mode runs multiple models in parallel and synthesizes the best response for complex queries.
              </p>
              <ul className="text-xs text-foreground space-y-1 list-disc list-inside">
                <li>Multiple models process the same query simultaneously</li>
                <li>Each model generates its own response independently</li>
                <li>Voting strategy (majority, weighted, or chairman-led) determines the final output</li>
                <li>Quality scores are calculated for council vs single-model responses</li>
                <li>Best response is selected based on voting outcome and quality thresholds</li>
                <li>Performance metrics track cost overhead and latency impact</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
