"use client";

import React, { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';

interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  user: any | null;
}

interface UploadJob {
  job_id: string;
  filename: string;
  status: 'created' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: any;
  error_message?: string;
}

const BackendIntegration: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>({
    isAuthenticated: false,
    token: null,
    user: null
  });
  
  const [uploadJobs, setUploadJobs] = useState<UploadJob[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);

  const API_BASE = 'http://localhost:8000';

  // Authentication functions
  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        setAuth({
          isAuthenticated: true,
          token: data.access_token,
          user: data.user
        });
        return { success: true, data };
      } else {
        const error = await response.text();
        return { success: false, error };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, []);

  const logout = useCallback(() => {
    setAuth({
      isAuthenticated: false,
      token: null,
      user: null
    });
  }, []);

  // File upload function
  const uploadFile = useCallback(async (file: File) => {
    if (!auth.token) {
      alert('Please login first');
      return;
    }

    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('user_id', auth.user?.id || 'demo_user');
      formData.append('run_ai_analysis', 'true');

      const response = await fetch(`${API_BASE}/api/v1/upload/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${auth.token}`,
        },
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        const newJob: UploadJob = {
          job_id: result.job_id,
          filename: file.name,
          status: 'created',
          progress: 0
        };
        
        setUploadJobs(prev => [...prev, newJob]);
        
        // Start polling for job status
        pollJobStatus(result.job_id);
        
        return { success: true, job_id: result.job_id };
      } else {
        const error = await response.text();
        return { success: false, error };
      }
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setIsUploading(false);
    }
  }, [auth.token, auth.user]);

  // Poll job status
  const pollJobStatus = useCallback(async (jobId: string) => {
    if (!auth.token) return;

    const poll = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/v1/upload/jobs/${jobId}/status`, {
          headers: {
            'Authorization': `Bearer ${auth.token}`,
          },
        });

        if (response.ok) {
          const statusData = await response.json();
          
          setUploadJobs(prev => prev.map(job => 
            job.job_id === jobId 
              ? { ...job, ...statusData }
              : job
          ));

          // Continue polling if not completed
          if (statusData.status === 'processing' || statusData.status === 'created') {
            setTimeout(poll, 2000);
          }
        }
      } catch (error) {
        console.error('Error polling job status:', error);
      }
    };

    poll();
  }, [auth.token]);

  // Run integration tests
  const runIntegrationTests = useCallback(async () => {
    setIsRunningTests(true);
    setTestResults([]);

    const tests = [
      {
        name: 'Health Check',
        test: async () => {
          const response = await fetch(`${API_BASE}/health`);
          return { success: response.ok, details: `Status: ${response.status}` };
        }
      },
      {
        name: 'API Documentation',
        test: async () => {
          const response = await fetch(`${API_BASE}/docs`);
          return { success: response.ok, details: `Docs accessible: ${response.ok}` };
        }
      },
      {
        name: 'Authentication Status',
        test: async () => {
          if (!auth.token) {
            return { success: false, details: 'Not authenticated' };
          }
          
          const response = await fetch(`${API_BASE}/api/v1/auth/me`, {
            headers: { 'Authorization': `Bearer ${auth.token}` }
          });
          
          return { 
            success: response.ok, 
            details: response.ok ? 'Token valid' : `Status: ${response.status}` 
          };
        }
      },
      {
        name: 'CORS Headers',
        test: async () => {
          try {
            const response = await fetch(`${API_BASE}/api/v1/auth/status`, {
              method: 'OPTIONS',
              headers: { 'Origin': 'http://localhost:3000' }
            });
            
            const corsOrigin = response.headers.get('Access-Control-Allow-Origin');
            return { 
              success: !!corsOrigin, 
              details: corsOrigin ? `Origin: ${corsOrigin}` : 'No CORS headers' 
            };
          } catch (error) {
            return { success: false, details: error.message };
          }
        }
      }
    ];

    for (const test of tests) {
      try {
        const result = await test.test();
        setTestResults(prev => [...prev, {
          name: test.name,
          ...result,
          timestamp: new Date().toISOString()
        }]);
      } catch (error) {
        setTestResults(prev => [...prev, {
          name: test.name,
          success: false,
          details: error.message,
          timestamp: new Date().toISOString()
        }]);
      }
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsRunningTests(false);
  }, [auth.token]);

  // File drop handler
  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      uploadFile(files[0]);
    }
  }, [uploadFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
  }, [uploadFile]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Phase 2: Integration & Testing
        </h1>
        <p className="text-gray-600">
          Frontend-Backend Integration Dashboard
        </p>
      </div>

      {/* Authentication Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <CheckCircle className="mr-2 h-5 w-5 text-green-500" />
          Authentication Status
        </h2>
        
        {auth.isAuthenticated ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-green-700">
                Authenticated as {auth.user?.email || 'User'}
              </span>
            </div>
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Logout
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-red-700">Not authenticated</span>
            </div>
            <button
              onClick={() => login('demo@pollarbase.com', 'demo123')}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Login with Demo Account
            </button>
          </div>
        )}
      </div>

      {/* File Upload Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Upload className="mr-2 h-5 w-5 text-blue-500" />
          File Upload & Processing
        </h2>
        
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors"
          onDrop={handleFileDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-600 mb-4">
            Drag and drop a file here, or click to select
          </p>
          <input
            type="file"
            onChange={handleFileSelect}
            accept=".csv,.json,.xlsx,.xls"
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="px-4 py-2 bg-blue-500 text-white rounded cursor-pointer hover:bg-blue-600"
          >
            Select File
          </label>
        </div>

        {isUploading && (
          <div className="mt-4 flex items-center justify-center">
            <Loader2 className="animate-spin h-5 w-5 mr-2" />
            <span>Uploading...</span>
          </div>
        )}

        {/* Upload Jobs */}
        {uploadJobs.length > 0 && (
          <div className="mt-6 space-y-4">
            <h3 className="font-semibold">Upload Jobs</h3>
            {uploadJobs.map((job) => (
              <div key={job.job_id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{job.filename}</span>
                  <div className="flex items-center space-x-2">
                    {job.status === 'completed' && (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                    {job.status === 'failed' && (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    {job.status === 'processing' && (
                      <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                    )}
                    <span className="text-sm text-gray-600">{job.status}</span>
                  </div>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${job.progress}%` }}
                  ></div>
                </div>
                
                {job.error_message && (
                  <p className="text-red-600 text-sm mt-2">{job.error_message}</p>
                )}
                
                {job.result && (
                  <div className="mt-2 text-sm text-gray-600">
                    <p>Analysis completed successfully</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Integration Tests Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <AlertCircle className="mr-2 h-5 w-5 text-orange-500" />
          Integration Tests
        </h2>
        
        <button
          onClick={runIntegrationTests}
          disabled={isRunningTests}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          {isRunningTests && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
          {isRunningTests ? 'Running Tests...' : 'Run Integration Tests'}
        </button>

        {testResults.length > 0 && (
          <div className="mt-6 space-y-2">
            <h3 className="font-semibold">Test Results</h3>
            {testResults.map((result, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-3 rounded ${
                  result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                }`}
              >
                <div className="flex items-center space-x-3">
                  {result.success ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <span className="font-medium">{result.name}</span>
                </div>
                <span className="text-sm text-gray-600">{result.details}</span>
              </div>
            ))}
            
            <div className="mt-4 p-4 bg-gray-50 rounded">
              <p className="font-semibold">
                Test Summary: {testResults.filter(r => r.success).length}/{testResults.length} passed
              </p>
              <p className="text-sm text-gray-600">
                Success Rate: {((testResults.filter(r => r.success).length / testResults.length) * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        )}
      </div>

      {/* System Status */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <FileText className="mr-2 h-5 w-5 text-purple-500" />
          System Status
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600"></div>
            <div className="text-sm font-medium">Authentication</div>
            <div className="text-xs text-gray-600">JWT & Security</div>
          </div>
          
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600"></div>
            <div className="text-sm font-medium">File Processing</div>
            <div className="text-xs text-gray-600">Upload & AI Analysis</div>
          </div>
          
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">🔌</div>
            <div className="text-sm font-medium">API Integration</div>
            <div className="text-xs text-gray-600">REST & WebSocket</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BackendIntegration; 