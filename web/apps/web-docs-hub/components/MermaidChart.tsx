'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import Script from 'next/script';

declare global {
  interface Window {
    mermaid?: {
      initialize: (config: object) => void;
      render: (id: string, text: string) => Promise<{ svg: string }>;
    };
  }
}

interface MermaidChartProps {
  chart: string;
}

export function MermaidChart({ chart }: MermaidChartProps) {
  const [svg, setSvg] = useState<string>('');
  const [scriptReady, setScriptReady] = useState(false);
  const { resolvedTheme } = useTheme();
  const idRef = useRef(`mermaid-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (!scriptReady || !window.mermaid) return;
    let cancelled = false;

    window.mermaid.initialize({
      startOnLoad: false,
      theme: resolvedTheme === 'dark' ? 'dark' : 'neutral',
      fontFamily: 'inherit',
      flowchart: { curve: 'basis', padding: 20 },
    });

    window.mermaid.render(idRef.current, chart.trim())
      .then(({ svg }) => { if (!cancelled) setSvg(svg); })
      .catch(console.error);

    return () => { cancelled = true; };
  }, [chart, resolvedTheme, scriptReady]);

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"
        strategy="lazyOnload"
        onLoad={() => setScriptReady(true)}
      />
      {svg ? (
        <div
          className="my-6 flex justify-center overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="my-6 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-8 text-sm text-gray-400">
          Loading diagram…
        </div>
      )}
    </>
  );
}
