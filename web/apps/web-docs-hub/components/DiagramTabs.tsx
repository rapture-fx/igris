'use client';

import { useState } from 'react';
import { MermaidChart } from './MermaidChart';

interface DiagramTabsProps {
  chart: string;
}

export function DiagramTabs({ chart }: DiagramTabsProps) {
  const [tab, setTab] = useState<'code' | 'diagram'>('code');

  return (
    <div className="my-6">
      <div className="flex gap-1 mb-0 border-b border-gray-200 dark:border-gray-700">
        {(['code', 'diagram'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors capitalize ${
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
        <pre className="my-0 rounded-b-lg rounded-tr-lg border border-t-0 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 text-[0.6875rem] font-mono leading-relaxed overflow-x-auto text-gray-700 dark:text-gray-300 whitespace-pre">
          {chart.trim()}
        </pre>
      )}
    </div>
  );
}
