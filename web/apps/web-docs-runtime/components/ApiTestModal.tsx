'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Send, Copy, Check, ChevronDown } from 'lucide-react';

interface ApiTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEndpoint?: string;
  defaultMethod?: string;
}

const endpoints = [
  { path: '/v1/health', method: 'GET', description: 'Health Check' },
  { path: '/v1/infer', method: 'POST', description: 'Inference (OpenAI-Compatible)' },
  { path: '/v1/chat/completions', method: 'POST', description: 'Chat Completions' },
  { path: '/v1/embeddings', method: 'POST', description: 'Embeddings' },
  { path: '/v1/providers', method: 'GET', description: 'List Providers' },
  { path: '/v1/providers/{name}/stats', method: 'GET', description: 'Provider Stats' },
  { path: '/v1/providers/custom', method: 'POST', description: 'Register Custom Provider' },
  { path: '/v1/admin/tenants', method: 'POST', description: 'Create Tenant' },
  { path: '/v1/tenants/{id}/usage', method: 'GET', description: 'Get Tenant Usage' },
  { path: '/v1/tenants/{id}/costs/breakdown', method: 'GET', description: 'Get Cost Breakdown' },
  { path: '/v1/routing/preview', method: 'POST', description: 'Preview Routing Decision' },
  { path: '/v1/health/metrics', method: 'GET', description: 'Health Metrics' },
  { path: '/metrics', method: 'GET', description: 'Prometheus Metrics' },
  { path: '/admin/optimizer', method: 'POST', description: 'Update Optimizer Config' },
  { path: '/admin/routing/reset', method: 'POST', description: 'Reset Thompson Sampling' },
];

export function ApiTestModal({ isOpen, onClose, defaultEndpoint, defaultMethod }: ApiTestModalProps) {
  const [selectedEndpoint, setSelectedEndpoint] = useState(defaultEndpoint || '/v1/health');
  const [selectedMethod, setSelectedMethod] = useState(defaultMethod || 'GET');
  const [copied, setCopied] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (defaultEndpoint) setSelectedEndpoint(defaultEndpoint);
    if (defaultMethod) setSelectedMethod(defaultMethod);
  }, [defaultEndpoint, defaultMethod]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(selectedEndpoint);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleSend = async () => {
    setIsLoading(true);
    setResponse('Sending request...');

    // Simulate API call
    setTimeout(() => {
      setResponse(JSON.stringify({
        status: 'ok',
        message: 'This is a demo response',
        endpoint: selectedEndpoint,
        method: selectedMethod,
      }, null, 2));
      setIsLoading(false);
    }, 1000);
  };

  const handleSelectEndpoint = (endpoint: typeof endpoints[0]) => {
    setSelectedEndpoint(endpoint.path);
    setSelectedMethod(endpoint.method);
    setIsDropdownOpen(false);
    setResponse('');
  };

  if (!isOpen) return null;

  const currentEndpoint = endpoints.find(e => e.path === selectedEndpoint);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-5xl mx-4 bg-beige-primary rounded-2xl shadow-2xl border border-gray-200 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 bg-beige-secondary">
          <div className="flex items-center gap-4 px-6 py-4">
            {/* Endpoint Dropdown */}
            <div className="relative flex-shrink-0" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-900 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors min-w-[200px]"
              >
                <span className="flex-1 text-left truncate">{currentEndpoint?.description || 'Select endpoint'}</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                  {endpoints.map((endpoint, index) => (
                    <button
                      key={index}
                      onClick={() => handleSelectEndpoint(endpoint)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                          endpoint.method === 'GET' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {endpoint.method}
                        </span>
                        <span className="text-sm font-medium text-gray-900">{endpoint.description}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1 ml-14">{endpoint.path}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Endpoint Address */}
            <div className="flex-1 flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg">
              <span className={`px-2 py-0.5 text-xs font-bold rounded flex-shrink-0 ${
                selectedMethod === 'GET' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
              }`}>
                {selectedMethod}
              </span>
              <code className="flex-1 text-sm text-gray-900 font-mono">{selectedEndpoint}</code>
              <button
                onClick={handleCopy}
                className="flex-shrink-0 p-1 hover:bg-gray-100 rounded transition-colors"
              >
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-gray-500" />}
              </button>
            </div>

            {/* Send Button */}
            <button
              onClick={handleSend}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="h-4 w-4" />
              <span>Send</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-600" />
            </button>
          </div>

          {/* Subheader */}
          <div className="px-6 pb-3">
            <p className="text-sm text-gray-600">Search and analyze session performance metrics</p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm">
            <pre className="text-gray-100 whitespace-pre-wrap">
              {response || '// Click "Send" to test this endpoint\n// Response will appear here'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
