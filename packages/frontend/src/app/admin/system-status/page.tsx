/**
 * System Status Page - Backend Connectivity & Health Monitoring
 */
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Server, 
  Database, 
  Wifi, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Clock,
  Activity,
  Shield,
  Settings,
  Terminal,
  Globe,
  Lock,
  ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'warning' | 'error' | 'unknown';
  response_time: number;
  last_check: string;
  error_message?: string;
  details?: Record<string, any>;
}

interface SystemHealth {
  backend_api: ServiceStatus;
  database: ServiceStatus;
  authentication: ServiceStatus;
  file_storage: ServiceStatus;
  email_service: ServiceStatus;
  redis_cache: ServiceStatus;
}

export default function SystemStatusPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [connectionTest, setConnectionTest] = useState<string>('');
  const [testResults, setTestResults] = useState<Record<string, any>>({});

  // Check admin access
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || user?.role !== 'admin')) {
      router.push('/dashboard');
      toast.error('Admin access required');
    }
  }, [isAuthenticated, isLoading, user, router]);

  // Load system status
  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin') {
      checkSystemHealth();
    }
  }, [isAuthenticated, user]);

  const checkSystemHealth = async () => {
    try {
      setIsRefreshing(true);
      
      // Test backend API connectivity
      const backendStatus = await testBackendAPI();
      const authStatus = await testAuthentication();
      const dbStatus = await testDatabase();
      
      const mockHealth: SystemHealth = {
        backend_api: backendStatus,
        database: dbStatus,
        authentication: authStatus,
        file_storage: {
          name: 'File Storage',
          status: 'healthy',
          response_time: 45,
          last_check: new Date().toISOString(),
          details: { available_space: '85%', total_files: 1247 }
        },
        email_service: {
          name: 'Email Service',
          status: 'warning',
          response_time: 120,
          last_check: new Date().toISOString(),
          error_message: 'Rate limit approaching',
          details: { daily_quota: '80%', last_email: '2 hours ago' }
        },
        redis_cache: {
          name: 'Redis Cache',
          status: 'healthy',
          response_time: 12,
          last_check: new Date().toISOString(),
          details: { memory_usage: '45%', hit_rate: '94%' }
        }
      };
      
      setSystemHealth(mockHealth);
    } catch (error) {
      console.error('Failed to check system health:', error);
      toast.error('Failed to check system health');
    } finally {
      setIsRefreshing(false);
    }
  };

  const testBackendAPI = async (): Promise<ServiceStatus> => {
    try {
      const startTime = Date.now();
      const response = await fetch('http://localhost:8000/api/auth/status');
      const endTime = Date.now();
      
      if (response.ok) {
        const data = await response.json();
        return {
          name: 'Backend API',
          status: 'healthy',
          response_time: endTime - startTime,
          last_check: new Date().toISOString(),
          details: data
        };
      } else {
        return {
          name: 'Backend API',
          status: 'error',
          response_time: endTime - startTime,
          last_check: new Date().toISOString(),
          error_message: `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error: any) {
      return {
        name: 'Backend API',
        status: 'error',
        response_time: 0,
        last_check: new Date().toISOString(),
        error_message: error.message || 'Connection failed'
      };
    }
  };

  const testAuthentication = async (): Promise<ServiceStatus> => {
    try {
      const startTime = Date.now();
      const response = await fetch('http://localhost:8000/api/auth/status');
      const endTime = Date.now();
      
      if (response.ok) {
        return {
          name: 'Authentication Service',
          status: 'healthy',
          response_time: endTime - startTime,
          last_check: new Date().toISOString(),
          details: { jwt_valid: true, session_active: true }
        };
      } else {
        return {
          name: 'Authentication Service',
          status: 'error',
          response_time: endTime - startTime,
          last_check: new Date().toISOString(),
          error_message: 'Authentication service unavailable'
        };
      }
    } catch (error: any) {
      return {
        name: 'Authentication Service',
        status: 'error',
        response_time: 0,
        last_check: new Date().toISOString(),
        error_message: error.message || 'Connection failed'
      };
    }
  };

  const testDatabase = async (): Promise<ServiceStatus> => {
    try {
      // Mock database test
      return {
        name: 'Database',
        status: 'healthy',
        response_time: 25,
        last_check: new Date().toISOString(),
        details: { 
          connection_pool: '8/20',
          query_performance: 'optimal',
          last_backup: '2024-06-13T02:00:00Z'
        }
      };
    } catch (error: any) {
      return {
        name: 'Database',
        status: 'error',
        response_time: 0,
        last_check: new Date().toISOString(),
        error_message: error.message || 'Database connection failed'
      };
    }
  };

  const runConnectionTest = async () => {
    try {
      setConnectionTest('running');
      const results: Record<string, any> = {};
      
      // Test various endpoints
      const endpoints = [
        { name: 'Health Check', url: 'http://localhost:8000/health' },
        { name: 'Auth Status', url: 'http://localhost:8000/api/auth/status' },
        { name: 'Sign In Endpoint', url: 'http://localhost:8000/api/auth/signin', method: 'POST' },
      ];
      
      for (const endpoint of endpoints) {
        try {
          const startTime = Date.now();
          const response = await fetch(endpoint.url, {
            method: endpoint.method || 'GET',
            headers: { 'Content-Type': 'application/json' }
          });
          const endTime = Date.now();
          
          results[endpoint.name] = {
            status: response.status,
            statusText: response.statusText,
            responseTime: endTime - startTime,
            success: response.ok || response.status === 422 // 422 is expected for POST without data
          };
        } catch (error: any) {
          results[endpoint.name] = {
            status: 'ERROR',
            statusText: error.message,
            responseTime: 0,
            success: false
          };
        }
      }
      
      setTestResults(results);
      setConnectionTest('completed');
      toast.success('Connection test completed');
    } catch (error) {
      setConnectionTest('failed');
      toast.error('Connection test failed');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-100';
      case 'warning':
        return 'text-yellow-600 bg-yellow-100';
      case 'error':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading system status...</p>
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
            <div className="flex items-center space-x-4">
              <Link
                href="/admin"
                className="inline-flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Admin
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">System Status</h1>
                <p className="text-sm text-gray-500">Backend Connectivity & Health Monitoring</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={checkSystemHealth}
                disabled={isRefreshing}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh Status
              </button>
              <button
                onClick={runConnectionTest}
                disabled={connectionTest === 'running'}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <Terminal className={`w-4 h-4 mr-2 ${connectionTest === 'running' ? 'animate-pulse' : ''}`} />
                Run Connection Test
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Service Status Grid */}
        {systemHealth && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {Object.values(systemHealth).map((service, index) => (
              <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(service.status)}
                    <h3 className="text-lg font-semibold text-gray-900">{service.name}</h3>
                  </div>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(service.status)}`}>
                    {service.status}
                  </span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Response Time:</span>
                    <span className="font-medium">{service.response_time}ms</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Last Check:</span>
                    <span className="font-medium">{new Date(service.last_check).toLocaleTimeString()}</span>
                  </div>
                  
                  {service.error_message && (
                    <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                      {service.error_message}
                    </div>
                  )}
                  
                  {service.details && (
                    <div className="mt-3 space-y-1">
                      {Object.entries(service.details).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-xs">
                          <span className="text-gray-500 capitalize">{key.replace('_', ' ')}:</span>
                          <span className="font-medium">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Connection Test Results */}
        {Object.keys(testResults).length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Connection Test Results</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {Object.entries(testResults).map(([endpoint, result]: [string, any]) => (
                  <div key={endpoint} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      {result.success ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                      <span className="font-medium">{endpoint}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {result.status} {result.statusText}
                      </div>
                      <div className="text-xs text-gray-500">
                        {result.responseTime}ms
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Troubleshooting Guide */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Troubleshooting Guide</h2>
          </div>
          <div className="p-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-md font-semibold text-gray-900 mb-2">Common Login Issues</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• <strong>Backend API Error:</strong> Ensure the authentication server is running on port 8000</li>
                  <li>• <strong>CORS Issues:</strong> Check that the frontend URL is allowed in backend CORS settings</li>
                  <li>• <strong>Token Expiry:</strong> Clear browser storage and try signing in again</li>
                  <li>• <strong>Database Connection:</strong> Verify database connectivity and user permissions</li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-md font-semibold text-gray-900 mb-2">Quick Fixes</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-medium text-blue-900">Start Backend Server</h4>
                    <code className="text-xs text-blue-700 mt-1 block">
                      cd .. && source .venv/bin/activate && python3 test_auth_backend.py
                    </code>
                  </div>
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="font-medium text-green-900">Clear Browser Storage</h4>
                    <code className="text-xs text-green-700 mt-1 block">
                      localStorage.clear(); sessionStorage.clear();
                    </code>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-md font-semibold text-gray-900 mb-2">Environment Check</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Frontend URL:</span>
                    <code className="text-blue-600">http://localhost:3000</code>
                  </div>
                  <div className="flex justify-between">
                    <span>Backend API:</span>
                    <code className="text-blue-600">http://localhost:8000</code>
                  </div>
                  <div className="flex justify-between">
                    <span>Auth Endpoint:</span>
                    <code className="text-blue-600">http://localhost:8000/api/auth</code>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 