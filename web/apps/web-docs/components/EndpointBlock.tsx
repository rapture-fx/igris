'use client';

import { useState } from 'react';
import { ApiTestModal } from './ApiTestModal';

interface EndpointBlockProps {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  children: React.ReactNode;
}

export function EndpointBlock({ method, path, children }: EndpointBlockProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const methodColors = {
    GET: 'bg-blue-100 text-blue-700 border-blue-200',
    POST: 'bg-green-100 text-green-700 border-green-200',
    PUT: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    DELETE: 'bg-red-100 text-red-700 border-red-200',
    PATCH: 'bg-purple-100 text-purple-700 border-purple-200',
  };

  return (
    <>
      <div className="relative my-6">
        {/* Header with Badge and Try it Button */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 text-sm font-bold rounded-lg border ${methodColors[method]}`}>
              {method}
            </span>
            <code className="text-base font-mono font-semibold text-gray-900">{path}</code>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 text-sm font-medium text-gray-900 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors shadow-sm"
          >
            Try it
          </button>
        </div>

        {/* Content */}
        <div className="pl-2">{children}</div>
      </div>

      <ApiTestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        defaultEndpoint={path}
        defaultMethod={method}
      />
    </>
  );
}
