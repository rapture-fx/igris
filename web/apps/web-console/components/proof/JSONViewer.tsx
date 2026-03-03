'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import { downloadJSON } from '@/utils/helpers';

interface JSONViewerProps {
  data: unknown;
  filename?: string;
  defaultOpen?: boolean;
}

export function JSONViewer({ data, filename = 'data', defaultOpen = false }: JSONViewerProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 rounded-md overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="text-xs text-gray-600 flex items-center gap-1.5">
          {open
            ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
            : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
          raw json
        </span>
        {open && (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); downloadJSON(data, filename); }}
            className="text-[10px] text-gray-400 hover:text-gray-700 flex items-center gap-1 transition-colors"
          >
            <Download className="h-3 w-3" /> download
          </span>
        )}
      </button>
      {open && (
        <pre className="text-[11px] text-gray-600 bg-white p-3 overflow-auto max-h-72 leading-relaxed border-t border-gray-100">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
