'use client';

import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from 'next-themes';
import { MermaidChart } from './MermaidChart';

interface DiagramTabsProps {
  chart: string;
}

export function DiagramTabs({ chart }: DiagramTabsProps) {
  const [tab, setTab] = useState<'code' | 'diagram'>('code');
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className="my-6">
      {/* Tabs — no container border, only active tab has a thin indicator */}
      <div className="flex gap-1 mb-2">
        {(['code', 'diagram'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors capitalize ${
              tab === t
                ? 'text-gray-900 dark:text-[#f6f6f4] border-b border-gray-800 dark:border-[#f6f6f4]'
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
        <div className="rounded-lg overflow-hidden">
          <SyntaxHighlighter
            language="markdown"
            style={isDark ? oneDark : oneLight}
            customStyle={{
              margin: 0,
              border: 'none',
              borderRadius: '0.5rem',
              padding: '1.25rem',
              fontSize: '0.6875rem',
              lineHeight: '1.6',
            }}
          >
            {chart.trim()}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  );
}
