'use client';

export const dynamic = 'force-dynamic';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose, SheetBody } from '@/components/ui/sheet';
import { useTenant } from '@/hooks/useTenant';
import { formatCurrency, formatNumber, formatLatency, formatDateTime, downloadCSV, downloadJSON, cn } from '@/utils/helpers';
import {
  Activity, Download, Clock, Database, Filter, Search, X,
  ChevronDown, ChevronUp, Copy, Share2, AlertCircle, CheckCircle,
  XCircle, Loader2, BarChart3, Zap
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { CHART_COLORS } from '@/utils/constants';

// Types
interface RequestTrace {
  id: string;
  timestamp: string;
  model: string;
  provider: string;
  status: number;
  latency: number;
  cost: number;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  user_id?: string;
  request_id: string;
  headers?: Record<string, string>;
  request_body?: any;
  response_body?: any;
  error?: {
    message: string;
    stack?: string;
  };
  token_timeline?: Array<{ token_index: number; timestamp: number }>;
  trace_waterfall?: Array<{
    provider: string;
    start: number;
    duration: number;
    status: 'success' | 'failed' | 'winner';
  }>;
  retry_count?: number;
}

// Mock data generator
const generateMockTraces = (count: number): RequestTrace[] => {
  const providers = ['OpenAI', 'Anthropic', 'Google', 'xAI'];
  const models = ['gpt-4', 'gpt-4-turbo', 'claude-3-opus', 'claude-3-sonnet', 'gemini-pro', 'grok-1'];
  const statuses = [200, 200, 200, 200, 429, 500];

  return Array.from({ length: count }, (_, i) => {
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const provider = providers[Math.floor(Math.random() * providers.length)];
    const model = models[Math.floor(Math.random() * models.length)];
    const latency = Math.floor(Math.random() * 800) + 100;
    const inputTokens = Math.floor(Math.random() * 2000) + 100;
    const outputTokens = Math.floor(Math.random() * 1500) + 50;
    const cost = (inputTokens * 0.00001 + outputTokens * 0.00003);

    const baseTime = Date.now() - (i * 60000);

    return {
      id: `trace_${i + 1}`,
      timestamp: new Date(baseTime).toISOString(),
      model,
      provider,
      status,
      latency,
      cost,
      tokens: {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens,
      },
      user_id: `user_${Math.floor(Math.random() * 100)}`,
      request_id: `req_${Date.now()}_${i}`,
      headers: {
        'content-type': 'application/json',
        'user-agent': 'schlep-sdk/1.0',
      },
      request_body: {
        model,
        messages: [{ role: 'user', content: 'Sample request content' }],
        max_tokens: outputTokens,
      },
      response_body: status === 200 ? {
        id: `chatcmpl_${i}`,
        choices: [{ message: { role: 'assistant', content: 'Sample response content' } }],
        usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens },
      } : undefined,
      error: status !== 200 ? {
        message: status === 429 ? 'Rate limit exceeded' : 'Internal server error',
        stack: status === 500 ? 'Error: Internal server error\n  at handler (/api/infer.ts:123)' : undefined,
      } : undefined,
      token_timeline: status === 200 ? Array.from({ length: Math.min(outputTokens, 50) }, (_, idx) => ({
        token_index: idx,
        timestamp: baseTime + (idx * (latency / 50)),
      })) : undefined,
      trace_waterfall: Math.random() > 0.7 ? [
        { provider: 'OpenAI', start: 0, duration: latency * 1.2, status: 'failed' as const },
        { provider: 'Anthropic', start: 0, duration: latency, status: 'winner' as const },
        { provider: 'Google', start: 0, duration: latency * 1.5, status: 'success' as const },
      ] : undefined,
      retry_count: status !== 200 ? Math.floor(Math.random() * 3) : 0,
    };
  });
};

export default function ObservabilityPage() {
  const router = useRouter();
  const { data: tenant, isLoading: tenantLoading } = useTenant();

  // State
  const [traces] = useState<RequestTrace[]>(() => generateMockTraces(150));
  const [selectedTrace, setSelectedTrace] = useState<RequestTrace | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    provider: '',
    model: '',
    status: '',
    minLatency: '',
    minCost: '',
    timeRange: '24h',
  });
  const [expandedSections, setExpandedSections] = useState({
    headers: false,
    request: false,
    response: false,
    error: false,
  });

  // Tier-based access control
  const tier = tenant?.plan || 'scale'; // Temporarily default to 'scale' for development
  const tierConfigs = {
    developer: { enabled: false, retention: 0, maxRequests: 0 },
    growth: { enabled: true, retention: 7, maxRequests: 1000 },
    scale: { enabled: true, retention: 90, maxRequests: 100000 },
    trial: { enabled: true, retention: 14, maxRequests: 50000 },
  };
  const tierConfig = tierConfigs[tier as keyof typeof tierConfigs] || tierConfigs.scale;

  // Redirect if tier doesn't have access
  if (!tenantLoading && !tierConfig.enabled) {
    router.push('/dashboard/usage');
    return null;
  }

  // Filtered traces
  const filteredTraces = useMemo(() => {
    return traces.filter(trace => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !trace.model.toLowerCase().includes(query) &&
          !trace.provider.toLowerCase().includes(query) &&
          !trace.request_id.toLowerCase().includes(query) &&
          !trace.user_id?.toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      // Provider filter
      if (filters.provider && trace.provider !== filters.provider) return false;

      // Model filter
      if (filters.model && trace.model !== filters.model) return false;

      // Status filter
      if (filters.status && trace.status.toString() !== filters.status) return false;

      // Latency filter
      if (filters.minLatency && trace.latency < parseInt(filters.minLatency)) return false;

      // Cost filter
      if (filters.minCost && trace.cost < parseFloat(filters.minCost)) return false;

      // Time range filter
      const now = Date.now();
      const traceTime = new Date(trace.timestamp).getTime();
      const timeRanges = {
        '1h': 3600000,
        '24h': 86400000,
        '7d': 604800000,
        '30d': 2592000000,
      };
      const rangeMs = timeRanges[filters.timeRange as keyof typeof timeRanges] || 86400000;

      if (now - traceTime > rangeMs) return false;

      return true;
    }).slice(0, tierConfig.maxRequests);
  }, [traces, searchQuery, filters, tierConfig.maxRequests]);

  // Metrics
  const metrics = useMemo(() => {
    const total = filteredTraces.length;
    const avgLatency = total > 0 ? filteredTraces.reduce((sum, t) => sum + t.latency, 0) / total : 0;
    const totalCost = filteredTraces.reduce((sum, t) => sum + t.cost, 0);
    const errorRate = total > 0 ? (filteredTraces.filter(t => t.status !== 200).length / total) * 100 : 0;

    return { total, avgLatency, totalCost, errorRate };
  }, [filteredTraces]);

  // Export handlers
  const handleExportCSV = () => {
    const exportData = filteredTraces.map(trace => ({
      timestamp: trace.timestamp,
      model: trace.model,
      provider: trace.provider,
      status: trace.status,
      latency: trace.latency,
      cost: trace.cost,
      tokens: trace.tokens.total,
      user_id: trace.user_id,
      request_id: trace.request_id,
    }));
    downloadCSV(exportData, `observability-${Date.now()}`);
  };

  const handleExportJSON = () => {
    downloadJSON(filteredTraces, `observability-${Date.now()}`);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getStatusBadge = (status: number) => {
    if (status === 200) {
      return <Badge className="bg-green-50 text-green-700 border-green-200">200 OK</Badge>;
    } else if (status === 429) {
      return <Badge className="bg-yellow-50 text-yellow-700 border-yellow-200">429 Rate Limit</Badge>;
    } else {
      return <Badge className="bg-red-50 text-red-700 border-red-200">{status} Error</Badge>;
    }
  };

  if (tenantLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-gray-900" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-medium text-gray-900 font-inter">
              Observability
            </h1>
            <p className="text-gray-600 mt-1 font-inter">
              Engineering-grade traces, token timelines, and request analytics
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="shadow-md" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" className="shadow-md" onClick={handleExportJSON}>
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-border-light shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Traces
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{formatNumber(metrics.total)}</div>
              <p className="text-xs text-gray-600 mt-1">
                Last {filters.timeRange === '1h' ? 'hour' : filters.timeRange === '24h' ? '24h' : filters.timeRange === '7d' ? '7 days' : '30 days'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Avg Latency
              </CardTitle>
              <Clock className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{formatLatency(metrics.avgLatency)}</div>
              <p className="text-xs text-gray-600 mt-1">Response time</p>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Cost
              </CardTitle>
              <Zap className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.totalCost)}</div>
              <p className="text-xs text-gray-600 mt-1">This period</p>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Error Rate
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{metrics.errorRate.toFixed(1)}%</div>
              <p className="text-xs text-gray-600 mt-1">
                {tier === 'scale' ? '90-day retention' : tier === 'growth' ? '7-day retention' : 'Limited'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-border-light shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-gray-900" />
              Filters & Search
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              {/* Search */}
              <div className="lg:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
                  <Input
                    placeholder="Search requests..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Provider */}
              <Select
                value={filters.provider}
                onChange={(e) => setFilters(prev => ({ ...prev, provider: e.target.value }))}
              >
                <option value="">All Providers</option>
                <option value="OpenAI">OpenAI</option>
                <option value="Anthropic">Anthropic</option>
                <option value="Google">Google</option>
                <option value="xAI">xAI</option>
              </Select>

              {/* Status */}
              <Select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              >
                <option value="">All Status</option>
                <option value="200">200 OK</option>
                <option value="429">429 Rate Limit</option>
                <option value="500">500 Error</option>
              </Select>

              {/* Latency */}
              <Input
                type="number"
                placeholder="Min latency (ms)"
                value={filters.minLatency}
                onChange={(e) => setFilters(prev => ({ ...prev, minLatency: e.target.value }))}
              />

              {/* Time Range */}
              <Select
                value={filters.timeRange}
                onChange={(e) => setFilters(prev => ({ ...prev, timeRange: e.target.value }))}
              >
                <option value="1h">Last Hour</option>
                <option value="24h">Last 24h</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </Select>
            </div>

            {/* Active Filters */}
            {(searchQuery || filters.provider || filters.status || filters.minLatency) && (
              <div className="flex gap-2 mt-4 flex-wrap">
                {searchQuery && (
                  <Badge variant="outline" className="gap-2">
                    Search: {searchQuery}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setSearchQuery('')} />
                  </Badge>
                )}
                {filters.provider && (
                  <Badge variant="outline" className="gap-2">
                    Provider: {filters.provider}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setFilters(prev => ({ ...prev, provider: '' }))} />
                  </Badge>
                )}
                {filters.status && (
                  <Badge variant="outline" className="gap-2">
                    Status: {filters.status}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setFilters(prev => ({ ...prev, status: '' }))} />
                  </Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setFilters({
                      provider: '',
                      model: '',
                      status: '',
                      minLatency: '',
                      minCost: '',
                      timeRange: '24h',
                    });
                  }}
                >
                  Clear All
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Request Traces Table */}
        <Card className="border-border-light shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-gray-900" />
              Request Traces
            </CardTitle>
            <CardDescription>
              {filteredTraces.length} of {traces.length} requests
              {tier === 'growth' && ' (Limited to 1,000 requests)'}
              {tier === 'scale' && ' (Up to 100,000 requests)'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredTraces.length === 0 ? (
              <div className="text-center py-12">
                <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No requests yet</h3>
                <p className="text-gray-600">Make your first call to see detailed traces.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border-light">
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Time</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Model</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Provider</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Latency</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Cost</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Tokens</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">User ID</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTraces.map((trace) => (
                      <tr
                        key={trace.id}
                        className="border-b border-border-light hover:bg-beige-secondary cursor-pointer transition-colors"
                        onClick={() => setSelectedTrace(trace)}
                      >
                        <td className="py-3 px-4 text-sm text-gray-900 font-inter">
                          {new Date(trace.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">
                          {trace.model}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {trace.provider}
                        </td>
                        <td className="py-3 px-4">
                          {getStatusBadge(trace.status)}
                        </td>
                        <td className="text-right py-3 px-4 text-sm text-gray-900">
                          {formatLatency(trace.latency)}
                        </td>
                        <td className="text-right py-3 px-4 text-sm text-gray-900">
                          {formatCurrency(trace.cost)}
                        </td>
                        <td className="text-right py-3 px-4 text-sm text-gray-900">
                          {formatNumber(trace.tokens.total)}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {trace.user_id}
                        </td>
                        <td className="text-right py-3 px-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTrace(trace);
                            }}
                          >
                            View
                          </Button>
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

      {/* Request Detail Sheet */}
      <Sheet open={!!selectedTrace} onOpenChange={(open) => !open && setSelectedTrace(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Request Trace Details</SheetTitle>
            <SheetClose onClick={() => setSelectedTrace(null)} />
          </SheetHeader>
          <SheetBody>
            {selectedTrace && (
              <div className="space-y-6">
                {/* Overview */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Overview</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-600">Model</p>
                      <p className="text-sm font-medium text-gray-900">{selectedTrace.model}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Provider</p>
                      <p className="text-sm font-medium text-gray-900">{selectedTrace.provider}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Latency</p>
                      <p className="text-sm font-medium text-gray-900">{formatLatency(selectedTrace.latency)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Cost</p>
                      <p className="text-sm font-medium text-gray-900">{formatCurrency(selectedTrace.cost)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Tokens</p>
                      <p className="text-sm font-medium text-gray-900">
                        {formatNumber(selectedTrace.tokens.total)} ({selectedTrace.tokens.input} in / {selectedTrace.tokens.output} out)
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Status</p>
                      <div className="mt-1">{getStatusBadge(selectedTrace.status)}</div>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-gray-600">Request ID</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm font-mono text-gray-900 truncate">{selectedTrace.request_id}</p>
                        <Copy
                          className="h-4 w-4 text-gray-600 cursor-pointer hover:text-gray-900"
                          onClick={() => copyToClipboard(selectedTrace.request_id)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Headers */}
                <div>
                  <button
                    onClick={() => toggleSection('headers')}
                    className="flex items-center justify-between w-full text-sm font-medium text-gray-900 mb-2"
                  >
                    Request Headers
                    {expandedSections.headers ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {expandedSections.headers && selectedTrace.headers && (
                    <pre className="bg-beige-secondary p-3 rounded-md text-xs overflow-x-auto">
                      {JSON.stringify(selectedTrace.headers, null, 2)}
                    </pre>
                  )}
                </div>

                {/* Request Body */}
                <div>
                  <button
                    onClick={() => toggleSection('request')}
                    className="flex items-center justify-between w-full text-sm font-medium text-gray-900 mb-2"
                  >
                    Request Body
                    {expandedSections.request ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {expandedSections.request && selectedTrace.request_body && (
                    <pre className="bg-beige-secondary p-3 rounded-md text-xs overflow-x-auto">
                      {JSON.stringify(selectedTrace.request_body, null, 2)}
                    </pre>
                  )}
                </div>

                {/* Response Body */}
                {selectedTrace.response_body && (
                  <div>
                    <button
                      onClick={() => toggleSection('response')}
                      className="flex items-center justify-between w-full text-sm font-medium text-gray-900 mb-2"
                    >
                      Response Body
                      {expandedSections.response ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {expandedSections.response && (
                      <pre className="bg-beige-secondary p-3 rounded-md text-xs overflow-x-auto">
                        {JSON.stringify(selectedTrace.response_body, null, 2)}
                      </pre>
                    )}
                  </div>
                )}

                {/* Token Timeline (Scale tier only) */}
                {tier === 'scale' && selectedTrace.token_timeline && selectedTrace.token_timeline.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Token Streaming Timeline (ms)</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={selectedTrace.token_timeline} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="token_index"
                          stroke="#6b7280"
                          label={{ value: 'Token #', position: 'insideBottom', offset: -10 }}
                          style={{ fontSize: '12px' }}
                        />
                        <YAxis
                          stroke="#6b7280"
                          width={45}
                          style={{ fontSize: '12px' }}
                        />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="timestamp"
                          stroke={CHART_COLORS.primary}
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Trace Waterfall (Scale tier only) */}
                {tier === 'scale' && selectedTrace.trace_waterfall && selectedTrace.trace_waterfall.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Trace Waterfall (Council Mode)</h3>
                    <div className="space-y-3">
                      {selectedTrace.trace_waterfall.map((trace, idx) => (
                        <div key={idx} className="flex items-center gap-2 w-full">
                          <span className="text-xs text-gray-600 w-20 flex-shrink-0">{trace.provider}</span>
                          <div className="flex-1 relative h-8 bg-beige-secondary rounded min-w-0">
                            <div
                              className={`absolute h-full rounded ${
                                trace.status === 'winner' ? 'bg-green-500' :
                                trace.status === 'success' ? 'bg-blue-500' :
                                'bg-red-500'
                              }`}
                              style={{
                                left: `${(trace.start / selectedTrace.latency) * 100}%`,
                                width: `${(trace.duration / selectedTrace.latency) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs text-gray-600 w-12 flex-shrink-0 text-right">{trace.duration.toFixed(0)}ms</span>
                          <Badge className={cn(
                            "flex-shrink-0 text-xs px-2",
                            trace.status === 'winner' ? 'bg-green-50 text-green-700' :
                            trace.status === 'success' ? 'bg-blue-50 text-blue-700' :
                            'bg-red-50 text-red-700'
                          )}>
                            {trace.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Error Details */}
                {selectedTrace.error && (
                  <div>
                    <button
                      onClick={() => toggleSection('error')}
                      className="flex items-center justify-between w-full text-sm font-medium text-red-700 mb-2"
                    >
                      <span className="flex items-center gap-2">
                        <XCircle className="h-4 w-4" />
                        Error Details
                      </span>
                      {expandedSections.error ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {expandedSections.error && (
                      <div className="bg-red-50 border border-red-200 p-3 rounded-md">
                        <p className="text-sm text-red-900 mb-2">{selectedTrace.error.message}</p>
                        {selectedTrace.error.stack && (
                          <pre className="text-xs text-red-800 overflow-x-auto">
                            {selectedTrace.error.stack}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Retry History */}
                {selectedTrace.retry_count && selectedTrace.retry_count > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-2">Retry History</h3>
                    <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-md">
                      <p className="text-sm text-yellow-900">
                        This request was retried {selectedTrace.retry_count} time{selectedTrace.retry_count > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t border-border-light">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => copyToClipboard(selectedTrace.request_id)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Request ID
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => copyToClipboard(JSON.stringify(selectedTrace, null, 2))}
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Copy Full Trace
                  </Button>
                </div>
              </div>
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
