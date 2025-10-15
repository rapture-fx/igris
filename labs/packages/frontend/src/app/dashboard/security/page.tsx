'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Shield, 
  Lock, 
  Key, 
  Eye, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Settings,
  Bell,
  Download,
  Filter,
  Search,
  Calendar,
  Clock,
  User,
  Globe,
  Smartphone,
  Monitor,
  Wifi
} from 'lucide-react';

interface SecurityEvent {
  id: string;
  type: 'login' | 'logout' | 'api_access' | 'permission_change' | 'security_alert' | 'data_access';
  severity: 'low' | 'medium' | 'high' | 'critical';
  user: string;
  description: string;
  timestamp: string;
  ip: string;
  location: string;
  device: string;
  status: 'success' | 'failed' | 'blocked';
}

const mockSecurityEvents: SecurityEvent[] = [
  {
    id: '1',
    type: 'login',
    severity: 'low',
    user: 'john@company.com',
    description: 'Successful login from new device',
    timestamp: '2023-12-01T10:30:00Z',
    ip: '192.168.1.100',
    location: 'San Francisco, CA',
    device: 'Chrome on macOS',
    status: 'success'
  },
  {
    id: '2',
    type: 'security_alert',
    severity: 'high',
    user: 'system',
    description: 'Multiple failed login attempts detected',
    timestamp: '2023-12-01T09:15:00Z',
    ip: '203.0.113.45',
    location: 'Unknown',
    device: 'Unknown',
    status: 'blocked'
  },
  {
    id: '3',
    type: 'api_access',
    severity: 'medium',
    user: 'api_user',
    description: 'API rate limit exceeded',
    timestamp: '2023-12-01T08:45:00Z',
    ip: '198.51.100.25',
    location: 'New York, NY',
    device: 'API Client',
    status: 'failed'
  },
  {
    id: '4',
    type: 'permission_change',
    severity: 'medium',
    user: 'admin@company.com',
    description: 'User permissions updated',
    timestamp: '2023-12-01T07:20:00Z',
    ip: '192.168.1.50',
    location: 'San Francisco, CA',
    device: 'Firefox on Windows',
    status: 'success'
  },
];

const severityColors = {
  low: 'bg-green-100 text-green-800 border-green-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  critical: 'bg-red-100 text-red-800 border-red-200',
};

const statusColors = {
  success: 'bg-green-100 text-green-800 border-green-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
  blocked: 'bg-gray-100 text-gray-800 border-gray-200',
};

const getEventIcon = (type: string) => {
  switch (type) {
    case 'login': return <User className="w-4 h-4" />;
    case 'logout': return <User className="w-4 h-4" />;
    case 'api_access': return <Key className="w-4 h-4" />;
    case 'permission_change': return <Settings className="w-4 h-4" />;
    case 'security_alert': return <AlertTriangle className="w-4 h-4" />;
    case 'data_access': return <Eye className="w-4 h-4" />;
    default: return <Shield className="w-4 h-4" />;
  }
};

const getDeviceIcon = (device: string) => {
  if (device.includes('mobile') || device.includes('Mobile')) return <Smartphone className="w-4 h-4" />;
  if (device.includes('API')) return <Wifi className="w-4 h-4" />;
  return <Monitor className="w-4 h-4" />;
};

export default function SecurityPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('7d');

  const filteredEvents = mockSecurityEvents.filter(event => {
    const matchesSearch = event.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.ip.includes(searchTerm);
    const matchesType = typeFilter === 'all' || event.type === typeFilter;
    const matchesSeverity = severityFilter === 'all' || event.severity === severityFilter;
    const matchesStatus = statusFilter === 'all' || event.status === statusFilter;
    
    return matchesSearch && matchesType && matchesSeverity && matchesStatus;
  });

  const stats = {
    totalEvents: mockSecurityEvents.length,
    criticalAlerts: mockSecurityEvents.filter(e => e.severity === 'critical').length,
    blockedAttempts: mockSecurityEvents.filter(e => e.status === 'blocked').length,
    activeUsers: new Set(mockSecurityEvents.filter(e => e.status === 'success').map(e => e.user)).size,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security Center"
        description="Monitor security events, manage access controls, and configure security settings"
      />

      {/* Security Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Events</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalEvents}</p>
            </div>
            <Shield className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Critical Alerts</p>
              <p className="text-2xl font-bold text-red-600">{stats.criticalAlerts}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Blocked Attempts</p>
              <p className="text-2xl font-bold text-orange-600">{stats.blockedAttempts}</p>
            </div>
            <XCircle className="w-8 h-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Users</p>
              <p className="text-2xl font-bold text-green-600">{stats.activeUsers}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>
      </div>

      {/* Security Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Authentication Settings
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Two-Factor Authentication</p>
                <p className="text-sm text-gray-500">Require 2FA for all users</p>
              </div>
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="ml-2 text-sm text-green-600">Enabled</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Session Timeout</p>
                <p className="text-sm text-gray-500">Auto-logout after inactivity</p>
              </div>
              <span className="text-sm text-gray-900">30 minutes</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Password Policy</p>
                <p className="text-sm text-gray-500">Minimum requirements</p>
              </div>
              <span className="text-sm text-gray-900">Strong</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Security Alerts
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Failed Login Alerts</p>
                <p className="text-sm text-gray-500">Notify on suspicious activity</p>
              </div>
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="ml-2 text-sm text-green-600">Enabled</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">API Rate Limit Alerts</p>
                <p className="text-sm text-gray-500">Monitor API usage</p>
              </div>
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="ml-2 text-sm text-green-600">Enabled</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Data Access Alerts</p>
                <p className="text-sm text-gray-500">Track sensitive data access</p>
              </div>
              <div className="flex items-center">
                <XCircle className="w-5 h-5 text-red-600" />
                <span className="ml-2 text-sm text-red-600">Disabled</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search events..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Event Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="login">Login</SelectItem>
                  <SelectItem value="logout">Logout</SelectItem>
                  <SelectItem value="api_access">API Access</SelectItem>
                  <SelectItem value="permission_change">Permissions</SelectItem>
                  <SelectItem value="security_alert">Security Alert</SelectItem>
                  <SelectItem value="data_access">Data Access</SelectItem>
                </SelectContent>
              </Select>

              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>

              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1d">Last 24h</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export
            </Button>
            <Button className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Configure
            </Button>
          </div>
        </div>
      </div>

      {/* Security Events Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Event
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Severity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEvents.map((event) => (
                <tr key={event.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        {getEventIcon(event.type)}
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">{event.description}</div>
                        <div className="text-sm text-gray-500 flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          {event.ip}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${severityColors[event.severity]}`}>
                      {event.severity.charAt(0).toUpperCase() + event.severity.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      {event.user}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>
                      <div className="flex items-center gap-1">
                        <Globe className="w-3 h-3 text-gray-400" />
                        {event.location}
                      </div>
                      <div className="flex items-center gap-1 text-gray-500 text-xs">
                        {getDeviceIcon(event.device)}
                        {event.device}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4 text-gray-400" />
                      {new Date(event.timestamp).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[event.status]}`}>
                      {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Empty State */}
      {filteredEvents.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No security events found</h3>
          <p className="text-gray-500">
            {searchTerm || typeFilter !== 'all' || severityFilter !== 'all' || statusFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'No security events recorded for the selected time period'
            }
          </p>
        </div>
      )}
    </div>
  );
} 