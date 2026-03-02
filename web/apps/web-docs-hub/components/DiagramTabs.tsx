'use client';

import { useState } from 'react';
import { MermaidChart } from './MermaidChart';

interface DiagramTabsProps {
  chart: string;
}

export function DiagramTabs({ chart }: DiagramTabsProps) {
  const [tab, setTab] = useState<'diagram' | 'code'>('diagram');

  return (
    <div className="my-6">
      <div className="flex gap-1 mb-0 border-b border-gray-200 dark:border-[#f6f6f4]/10">
        {(['diagram', 'code'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors rounded-t ${
              tab === t
                ? 'text-gray-900 dark:text-[#f6f6f4] border-b-2 border-gray-900 dark:border-[#f6f6f4]'
                : 'text-gray-400 dark:text-[#a8a89a] hover:text-gray-600 dark:hover:text-[#c8c8b8]'
            }`}
          >
            {t === 'diagram' ? 'Diagram' : 'Code'}
          </button>
        ))}
      </div>

      {tab === 'diagram' ? (
        <MermaidChart chart={chart} />
      ) : (
        <pre className="mt-0 rounded-b-lg rounded-tr-lg border border-t-0 border-gray-200 dark:border-[#f6f6f4]/10 bg-[#f7f7f3] dark:bg-[#1b1912] p-4 text-[0.6875rem] font-mono leading-relaxed overflow-x-auto text-gray-700 dark:text-[#c8c8b8] whitespace-pre">
          {chart.trim()}
        </pre>
      )}
    </div>
  );
}
