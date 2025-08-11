'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Zap, 
  Database, 
  Clock, 
  Users,
  Download,
  RefreshCw,
  Calendar,
  Activity,
  Server,
  HardDrive,
  Cpu,
  Network,
  Eye,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

interface UsageMetric {
  name: string;
  value: number;
  unit: string;
  change: number;
  changeType: 'increase' | 'decrease';
  trend: number[];
}

interface BillingInfo {
  currentPeriod: string;
  totalCost: number;
  breakdown: {
    apiCalls: number;
    storage: number;
    compute: number;
    bandwidth: number;
  };
  previousPeriod: number;
}

const mockUsageMetrics: UsageMetric[] = [
  {
    name: 'API Calls',
    value: 125840,
    unit: 'calls',
    change: 12.5,
    changeType: 'increase',
    trend: [100, 120, 115, 130, 125, 140, 135]
  },
  {
    name: 'Data Processed',
    value: 2.4,
    unit: 'TB',
    change: 8.2,
    changeType: 'increase',
    trend: [2.1, 2.2, 2.0, 2.3, 2.4, 2.5, 2.4]
  },
  {
    name: 'Storage Used',
    value: 1.8,
    unit: 'TB',
    change: 15.3,
    changeType: 'increase',
    trend: [1.5, 1.6, 1.7, 1.8, 1.9, 1.8, 1.8]
  },
  {
    name: 'Compute Hours',
    value: 456,
    unit: 'hours',
    change: 5.7,
    changeType: 'decrease',
    trend: [500, 480, 470, 460, 450, 455, 456]
  },
  {
    name: 'Bandwidth',
    value: 890,
    unit: 'GB',
    change: 22.1,
    changeType: 'increase',
    trend: [720, 750, 800, 850, 880, 890, 890]
  },
  {
    name: 'Active Users',
    value: 1247,
    unit: 'users',
    change: 18.9,
    changeType: 'increase',
    trend: [1050, 1100, 1150, 1200, 1220, 1240, 1247]
  }
];

const mockBillingInfo: BillingInfo = {
  currentPeriod: 'December 2023',
  totalCost: 2847.50,
  breakdown: {
    apiCalls: 1250.00,
    storage: 680.00,
    compute: 750.50,
    bandwidth: 167.00
  },
  previousPeriod: 2456.75
};

const apiUsageData = [
  { endpoint: '/api/v1/data/process', calls: 45230, avgResponse: 120, errors: 23 },
  { endpoint: '/api/v1/models/predict', calls: 32150, avgResponse: 85, errors: 12 },
  { endpoint: '/api/v1/data/upload', calls: 28940, avgResponse: 250, errors: 45 },
  { endpoint: '/api/v1/analytics/query', calls: 19625, avgResponse: 95, errors: 8 },
  { endpoint: '/api/v1/auth/validate', calls: 15890, avgResponse: 35, errors: 2 },
];

export default function UsagePage() {
  const [timeRange, setTimeRange] = useState<string>('7d');
  const [selectedTab, setSelectedTab] = useState<string>('overview');

  const costChange = ((mockBillingInfo.totalCost - mockBillingInfo.previousPeriod) / mockBillingInfo.previousPeriod) * 100;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usage Analytics"
        description="Monitor your resource usage, costs, and performance metrics"
      />

      {/* Time Range Selector */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold text-gray-900">Usage Overview</h3>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Time Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Billing Summary */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Billing Summary - {mockBillingInfo.currentPeriod}
          </h3>
          <div className="flex items-center gap-2 text-sm">
            {costChange > 0 ? (
              <div className="flex items-center gap-1 text-red-600">
                <TrendingUp className="w-4 h-4" />
                +{costChange.toFixed(1)}%
              </div>
            ) : (
              <div className="flex items-center gap-1 text-green-600">
                <TrendingDown className="w-4 h-4" />
                {costChange.toFixed(1)}%
              </div>
            )}
            <span className="text-gray-500">vs last month</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-1">
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900">${mockBillingInfo.totalCost.toLocaleString()}</p>
              <p className="text-sm text-gray-500">Total Cost</p>
            </div>
          </div>
          
          <div className="lg:col-span-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-xl font-semibold text-blue-600">${mockBillingInfo.breakdown.apiCalls.toLocaleString()}</p>
              <p className="text-sm text-gray-500">API Calls</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-semibold text-green-600">${mockBillingInfo.breakdown.storage.toLocaleString()}</p>
              <p className="text-sm text-gray-500">Storage</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-semibold text-orange-600">${mockBillingInfo.breakdown.compute.toLocaleString()}</p>
              <p className="text-sm text-gray-500">Compute</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-semibold text-purple-600">${mockBillingInfo.breakdown.bandwidth.toLocaleString()}</p>
              <p className="text-sm text-gray-500">Bandwidth</p>
            </div>
          </div>
        </div>
      </div>

      {/* Usage Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockUsageMetrics.map((metric, index) => (
          <div key={index} className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {metric.name === 'API Calls' && <Zap className="w-5 h-5 text-blue-600" />}
                {metric.name === 'Data Processed' && <Database className="w-5 h-5 text-green-600" />}
                {metric.name === 'Storage Used' && <HardDrive className="w-5 h-5 text-orange-600" />}
                {metric.name === 'Compute Hours' && <Cpu className="w-5 h-5 text-purple-600" />}
                {metric.name === 'Bandwidth' && <Network className="w-5 h-5 text-red-600" />}
                {metric.name === 'Active Users' && <Users className="w-5 h-5 text-indigo-600" />}
                <h4 className="font-medium text-gray-900">{metric.name}</h4>
              </div>
              <div className={`flex items-center gap-1 text-sm ${
                metric.changeType === 'increase' ? 'text-green-600' : 'text-red-600'
              }`}>
                {metric.changeType === 'increase' ? (
                  <ArrowUpRight className="w-4 h-4" />
                ) : (
                  <ArrowDownRight className="w-4 h-4" />
                )}
                {metric.change}%
              </div>
            </div>
            
            <div className="mb-4">
              <p className="text-2xl font-bold text-gray-900">
                {metric.value.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">{metric.unit}</p>
            </div>

            {/* Mini trend chart placeholder */}
            <div className="h-12 bg-gray-50 rounded flex items-end justify-between px-2">
              {metric.trend.map((value, i) => (
                <div
                  key={i}
                  className="bg-blue-500 rounded-sm"
                  style={{
                    height: `${(value / Math.max(...metric.trend)) * 100}%`,
                    width: '8px'
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'api', label: 'API Usage', icon: Zap },
              { id: 'resources', label: 'Resources', icon: Server },
              { id: 'performance', label: 'Performance', icon: Activity }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                  selectedTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {selectedTab === 'api' && (
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900 mb-4">API Endpoint Usage</h4>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Endpoint
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Calls
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Avg Response
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Errors
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {apiUsageData.map((endpoint, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {endpoint.endpoint}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {endpoint.calls.toLocaleString()}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {endpoint.avgResponse}ms
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            endpoint.errors > 20 ? 'bg-red-100 text-red-800' :
                            endpoint.errors > 10 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {endpoint.errors}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selectedTab === 'resources' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900">Storage Usage</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Raw Data</span>
                    <span className="text-sm font-medium">1.2 TB</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: '67%' }}></div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Processed Data</span>
                    <span className="text-sm font-medium">0.6 TB</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-green-600 h-2 rounded-full" style={{ width: '33%' }}></div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900">Compute Resources</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">CPU Usage</span>
                    <span className="text-sm font-medium">65%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-orange-600 h-2 rounded-full" style={{ width: '65%' }}></div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Memory Usage</span>
                    <span className="text-sm font-medium">78%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-purple-600 h-2 rounded-full" style={{ width: '78%' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedTab === 'performance' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">99.8%</p>
                  <p className="text-sm text-gray-500">Uptime</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">125ms</p>
                  <p className="text-sm text-gray-500">Avg Response Time</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-600">0.02%</p>
                  <p className="text-sm text-gray-500">Error Rate</p>
                </div>
              </div>
            </div>
          )}

          {selectedTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-4">Usage Trends</h4>
                  <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
                    <p className="text-gray-500">Usage trends chart would go here</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-4">Cost Breakdown</h4>
                  <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
                    <p className="text-gray-500">Cost breakdown chart would go here</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 