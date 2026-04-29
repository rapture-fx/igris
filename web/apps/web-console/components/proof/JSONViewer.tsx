'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadJSON } from '@/utils/helpers';

interface JSONViewerProps {
  data: unknown;
  filename?: string;
  defaultOpen?: boolean;
}

export function JSONViewer({ data, filename = 'data', defaultOpen = false }: JSONViewerProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 dark:border-border rounded-md overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-muted border-b border-gray-200 dark:border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(!open)}
          className="h-auto p-0 text-xs text-gray-600 dark:text-muted-foreground hover:bg-transparent gap-1.5 font-normal"
        >
          {open
            ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
            : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
          raw json
        </Button>
        {open && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => downloadJSON(data, filename)}
            className="h-auto p-0 text-[10px] text-gray-400 hover:text-gray-700 hover:bg-transparent gap-1 font-normal"
          >
            <Download className="h-3 w-3" /> download
          </Button>
        )}
      </div>
      {open && (
        <pre className="text-[11px] text-gray-600 dark:text-muted-foreground bg-white dark:bg-card p-3 overflow-auto max-h-72 leading-relaxed">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
