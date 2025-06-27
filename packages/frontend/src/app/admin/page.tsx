/**
 * Admin Dashboard - User Management & System Monitoring
 */
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Users, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Search,
  Filter,
  Download,
  Settings,
  Database,
  Server,
  Shield,
  Clock,
  Mail,
  Eye,
  EyeOff,
  Trash2,
  Edit,
  Plus,
  Monitor
} from 'lucide-react';
import { toast } from 'sonner';

interface AdminUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  last_login?: string;
  login_attempts: number;
  tenant_name?: string;
}

interface SystemStats {
  total_users: number;
  active_users: number;
  verified_users: number;
  failed_logins_24h: number;
  active_sessions: number;
  service_status: string;
  database_status: string;
  last_backup: string;
}

interface LoginAttempt {
  id: string;
  email: string;
  ip_address: string;
  success: boolean;
  timestamp: string;
  error_message?: string;
}

export default function AdminDashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [loginAttempts, setLoginAttempts] = useState<LoginAttempt[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);

  // Check admin access
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || user?.role !== 'admin')) {
      router.push('/dashboard');
      toast.error('Admin access required');
    }
  }, [isAuthenticated, isLoading, user, router]);

  // Load admin data
  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin') {
      loadAdminData();
    }
  }, [isAuthenticated, user]);

  const loadAdminData = async () => {
    try {
      setIsRefreshing(true);
      await Promise.all([
        loadUsers(),
        loadSystemStats(),
        loadLoginAttempts()
      ]);
    } catch (error) {
      console.error('Failed to load admin data:', error);
      toast.error('Failed to load admin data');
    } finally {
      setIsRefreshing(false);
    }
  };

  const loadUsers = async () => {
    try {
      // Mock data - replace with actual API call
      const mockUsers: AdminUser[] = [
        {
          id: '1',
          email: 'john.doe@example.com',
          first_name: 'John',
          last_name: 'Doe',
          role: 'user',
          is_verified: true,
          is_active: true,
          created_at: '2024-01-15T10:30:00Z',
          last_login: '2024-06-13T14:20:00Z',
          login_attempts: 0,
          tenant_name: 'TechCorp'
        },
        {
          id: '2',
          email: 'jane.smith@example.com',
          first_name: 'Jane',
          last_name: 'Smith',
          role: 'admin',
          is_verified: true,
          is_active: true,
          created_at: '2024-01-10T09:15:00Z',
          last_login: '2024-06-13T16:45:00Z',
          login_attempts: 0,
          tenant_name: 'DataFlow Inc'
        },
        {
          id: '3',
          email: 'failed.user@example.com',
          first_name: 'Failed',
          last_name: 'User',
          role: 'user',
          is_verified: false,
          is_active: false,
          created_at: '2024-06-12T08:00:00Z',
          login_attempts: 5,
          tenant_name: 'TestCorp'
        }
      ];
      setUsers(mockUsers);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const loadSystemStats = async () => {
    try {
      // Mock data - replace with actual API call
      const mockStats: SystemStats = {
        total_users: 156,
        active_users: 142,
        verified_users: 138,
        failed_logins_24h: 23,
        active_sessions: 45,
        service_status: 'healthy',
        database_status: 'connected',
        last_backup: '2024-06-13T02:00:00Z'
      };
      setSystemStats(mockStats);
    } catch (error) {
      console.error('Failed to load system stats:', error);
    }
  };

  const loadLoginAttempts = async () => {
    try {
      // Mock data - replace with actual API call
      const mockAttempts: LoginAttempt[] = [
        {
          id: '1',
          email: 'john.doe@example.com',
          ip_address: '192.168.1.100',
          success: true,
          timestamp: '2024-06-13T16:45:00Z'
        },
        {
          id: '2',
          email: 'failed.user@example.com',
          ip_address: '192.168.1.101',
          success: false,
          timestamp: '2024-06-13T16:30:00Z',
          error_message: 'Invalid credentials'
        },
        {
          id: '3',
          email: 'hacker@malicious.com',
          ip_address: '10.0.0.1',
          success: false,
          timestamp: '2024-06-13T16:15:00Z',
          error_message: 'Account not found'
        }
      ];
      setLoginAttempts(mockAttempts);
    } catch (error) {
      console.error('Failed to load login attempts:', error);
    }
  };

  const handleUserAction = async (userId: string, action: string) => {
    try {
      // Mock actions - replace with actual API calls
      switch (action) {
        case 'activate':
          toast.success('User activated successfully');
          break;
        case 'deactivate':
          toast.success('User deactivated successfully');
          break;
        case 'verify':
          toast.success('User verified successfully');
          break;
        case 'reset_password':
          toast.success('Password reset email sent');
          break;
        case 'delete':
          toast.success('User deleted successfully');
          break;
        default:
          toast.error('Unknown action');
      }
      await loadUsers();
    } catch (error) {
      toast.error('Action failed');
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.last_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && user.is_active) ||
                         (filterStatus === 'inactive' && !user.is_active) ||
                         (filterStatus === 'verified' && user.is_verified) ||
                         (filterStatus === 'unverified' && !user.is_verified);
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-sm text-gray-500">User Management & System Monitoring</p>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/admin/system-status"
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Monitor className="w-4 h-4 mr-2" />
                System Status
              </Link>
              <button
                onClick={loadAdminData}
                disabled={isRefreshing}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* System Stats */}
        {systemStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Users</p>
                  <p className="text-3xl font-bold text-gray-900">{systemStats.total_users}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Sessions</p>
                  <p className="text-3xl font-bold text-gray-900">{systemStats.active_sessions}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Activity className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Failed Logins (24h)</p>
                  <p className="text-3xl font-bold text-gray-900">{systemStats.failed_logins_24h}</p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">System Status</p>
                  <p className="text-lg font-semibold text-green-600 capitalize">{systemStats.service_status}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* User Management */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
              <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <Plus className="w-4 h-4 mr-2" />
                Add User
              </button>
            </div>
            
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
                />
              </div>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="user">User</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="verified">Verified</option>
                <option value="unverified">Unverified</option>
              </select>
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Login Attempts</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mr-3">
                          <span className="text-white font-semibold text-sm">
                            {user.first_name[0]}{user.last_name[0]}
                          </span>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {user.first_name} {user.last_name}
                          </div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                          {user.tenant_name && (
                            <div className="text-xs text-gray-400">{user.tenant_name}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        user.role === 'admin' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                        {user.is_verified ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.last_login 
                        ? new Date(user.last_login).toLocaleDateString()
                        : 'Never'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${
                        user.login_attempts > 3 ? 'text-red-600' : 'text-gray-900'
                      }`}>
                        {user.login_attempts}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setSelectedUser(user)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleUserAction(user.id, user.is_active ? 'deactivate' : 'activate')}
                          className={`${user.is_active ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`}
                        >
                          {user.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleUserAction(user.id, 'reset_password')}
                          className="text-yellow-600 hover:text-yellow-900"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleUserAction(user.id, 'delete')}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button className="w-full text-left px-4 py-2 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                Export User Data
              </button>
              <button className="w-full text-left px-4 py-2 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
                Send System Notification
              </button>
              <button className="w-full text-left px-4 py-2 bg-yellow-50 hover:bg-yellow-100 rounded-lg transition-colors">
                Generate Reports
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">System Health</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">API Status</span>
                <CheckCircle className="w-4 h-4 text-green-500" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Database</span>
                <CheckCircle className="w-4 h-4 text-green-500" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Email Service</span>
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">New user registered</span>
                <span className="text-gray-400">2m ago</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Failed login attempt</span>
                <span className="text-gray-400">5m ago</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">System backup completed</span>
                <span className="text-gray-400">1h ago</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 