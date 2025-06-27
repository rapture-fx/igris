"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Database, 
  Cloud, 
  Globe, 
  Activity, 
  Plus, 
  Settings, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  Trash2,
  RefreshCw,
  BarChart3,
  Zap,
  Shield,
  Users,
  Layers,
  TrendingUp,
  FileText,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface Connection {
  id: string;
  name: string;
  type: 'database' | 'cloud_storage' | 'api' | 'streaming';
  status: 'connected' | 'error' | 'connecting';
  lastUsed: string;
  config: any;
}

interface IntegrationStat {
  label: string;
  value: string | number;
  change?: string;
  icon: React.ReactNode;
  color: string;
}

interface IntegrationStats {
  total_investigations: number
  successful_uploads: number
  failed_uploads: number
  average_processing_time: number
  total_data_processed_gb: number
  quality_score_average: number
}

interface ProcessingMetrics {
  date: string
  uploads: number
  success_rate: number
  avg_quality: number
}

interface DataTypeDistribution {
  type: string
  count: number
  percentage: number
  color: string
}

const DataIntegrationDashboard: React.FC = () => {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'connections' | 'streaming' | 'settings'>('overview');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<IntegrationStats | null>(null);
  const [metrics, setMetrics] = useState<ProcessingMetrics[]>([]);
  const [dataTypes, setDataTypes] = useState<DataTypeDistribution[]>([]);

  // Mock data - replace with real API calls
  const mockConnections: Connection[] = [
    {
      id: '1',
      name: 'Production Database',
      type: 'database',
      status: 'connected',
      lastUsed: '2024-01-15T10:30:00Z',
      config: { host: 'prod-db.company.com', type: 'postgresql' }
    },
    {
      id: '2',
      name: 'AWS S3 Bucket',
      type: 'cloud_storage',
      status: 'connected',
      lastUsed: '2024-01-15T09:15:00Z',
      config: { bucket: 'data-lake-bucket', region: 'us-east-1' }
    },
    {
      id: '3',
      name: 'Analytics API',
      type: 'api',
      status: 'error',
      lastUsed: '2024-01-14T16:45:00Z',
      config: { baseUrl: 'https://api.analytics.com', version: 'v2' }
    },
    {
      id: '4',
      name: 'Kafka Stream',
      type: 'streaming',
      status: 'connecting',
      lastUsed: '2024-01-15T11:00:00Z',
      config: { topics: ['user-events', 'transactions'], brokers: ['kafka1:9092'] }
    }
  ];

  const integrationStats: IntegrationStat[] = [
    {
      label: 'Active Connections',
      value: connections.filter(c => c.status === 'connected').length,
      change: '+12%',
      icon: <Database className="w-5 h-5" />,
      color: 'text-blue-600'
    },
    {
      label: 'Data Sources',
      value: connections.length,
      change: '+3',
      icon: <Layers className="w-5 h-5" />,
      color: 'text-green-600'
    },
    {
      label: 'Streaming Events',
      value: '1.2M',
      change: '+8%',
      icon: <Activity className="w-5 h-5" />,
      color: 'text-purple-600'
    },
    {
      label: 'API Calls Today',
      value: '45.6K',
      change: '+15%',
      icon: <Globe className="w-5 h-5" />,
      color: 'text-orange-600'
    }
  ];

  useEffect(() => {
    setConnections(mockConnections);
    fetchIntegrationData();
  }, []);

  const fetchIntegrationData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };

      // In a real implementation, this would fetch from multiple endpoints
      // For now, we'll generate realistic mock data
      
      // Mock integration stats
      setStats({
        total_investigations: 42,
        successful_uploads: 38,
        failed_uploads: 4,
        average_processing_time: 45,
        total_data_processed_gb: 12.4,
        quality_score_average: 87.3
      });

      // Mock processing metrics over time
      const mockMetrics: ProcessingMetrics[] = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return {
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          uploads: Math.floor(Math.random() * 10) + 2,
          success_rate: 90 + Math.random() * 10,
          avg_quality: 80 + Math.random() * 20
        };
      });
      setMetrics(mockMetrics);

      // Mock data type distribution
      setDataTypes([
        { type: 'CSV', count: 18, percentage: 43, color: '#3B82F6' },
        { type: 'Excel', count: 12, percentage: 29, color: '#10B981' },
        { type: 'JSON', count: 8, percentage: 19, color: '#F59E0B' },
        { type: 'Parquet', count: 4, percentage: 9, color: '#8B5CF6' }
      ]);

    } catch (error) {
      console.error('Failed to fetch integration data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: Connection['status']) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'connecting':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getTypeIcon = (type: Connection['type']) => {
    switch (type) {
      case 'database':
        return <Database className="w-5 h-5 text-blue-500" />;
      case 'cloud_storage':
        return <Cloud className="w-5 h-5 text-purple-500" />;
      case 'api':
        return <Globe className="w-5 h-5 text-green-500" />;
      case 'streaming':
        return <Activity className="w-5 h-5 text-orange-500" />;
      default:
        return <Database className="w-5 h-5 text-gray-400" />;
    }
  };

  const formatLastUsed = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const formatBytes = (bytes: number) => {
    return `${bytes.toFixed(1)} GB`;
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {integrationStats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className={`p-2 rounded-lg bg-gray-50 ${stat.color}`}>
                {stat.icon}
              </div>
              {stat.change && (
                <span className={`text-sm font-medium ${
                  stat.change.startsWith('+') ? 'text-green-600' : 'text-red-600'
                }`}>
                  {stat.change}
                </span>
              )}
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-bold text-gray-900">{stat.value}</h3>
              <p className="text-sm text-gray-600 mt-1">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Recent Activity</h2>
          <button className="text-blue-600 hover:text-blue-700 font-medium text-sm">
            View All
          </button>
        </div>

        <div className="space-y-4">
          {connections.slice(0, 3).map((connection) => (
            <div key={connection.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                {getTypeIcon(connection.type)}
                <div>
                  <h3 className="font-medium text-gray-900">{connection.name}</h3>
                  <p className="text-sm text-gray-600 capitalize">{connection.type.replace('_', ' ')}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {getStatusIcon(connection.status)}
                <span className="text-sm text-gray-600">{formatLastUsed(connection.lastUsed)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Database, label: 'Add Database', color: 'bg-blue-500 hover:bg-blue-600' },
          { icon: Cloud, label: 'Cloud Storage', color: 'bg-purple-500 hover:bg-purple-600' },
          { icon: Globe, label: 'API Connection', color: 'bg-green-500 hover:bg-green-600' },
          { icon: Activity, label: 'Stream Data', color: 'bg-orange-500 hover:bg-orange-600' }
        ].map((action, index) => (
          <motion.button
            key={action.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 + index * 0.1 }}
            className={`${action.color} text-white p-4 rounded-xl flex items-center space-x-3 transition-colors`}
          >
            <action.icon className="w-5 h-5" />
            <span className="font-medium">{action.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-gray-200 rounded-lg"></div>
            <div className="h-64 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Data Integration</h1>
          <p className="text-gray-600 mt-2">
            Connect, manage, and monitor all your data sources in one place
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-8 mb-8 border-b border-gray-200">
          {[
            { key: 'overview', label: 'Overview', icon: BarChart3 },
            { key: 'connections', label: 'Connections', icon: Database },
            { key: 'streaming', label: 'Streaming', icon: Activity },
            { key: 'settings', label: 'Settings', icon: Settings }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center space-x-2 pb-4 border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === 'overview' && renderOverview()}
        </motion.div>
      </div>
    </div>
  );
};

export default DataIntegrationDashboard;

export { DataIntegrationDashboard }
