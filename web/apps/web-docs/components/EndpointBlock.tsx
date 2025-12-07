'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';
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
        <div className="flex items-center justify-between mb-4 pb-3 bg-beige-secondary rounded-lg px-4 py-3 border border-gray-200/30">
          <div className="flex items-center gap-2.5">
            <span className={`px-2 py-0.5 text-xs font-bold rounded border ${methodColors[method]}`}>
              {method}
            </span>
            <code className="text-sm font-mono text-gray-900">{path}</code>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3 py-1.5 text-xs font-medium text-gray-900 bg-beige-primary hover:bg-beige-secondary border border-gray-200 rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
          >
            Try it
            <Play className="h-3 w-3" fill="currentColor" />
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
