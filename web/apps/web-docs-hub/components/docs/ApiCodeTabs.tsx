'use client';

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { ApiCodeSample } from '@/lib/api-reference';

interface ApiCodeTabsProps {
  samples: ApiCodeSample[];
}

export function ApiCodeTabs({ samples }: ApiCodeTabsProps) {
  const [active, setActive] = useState(samples[0]?.label ?? '');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const preferred = window.localStorage.getItem('igris-api-language');
    if (preferred && samples.some((sample) => sample.label === preferred)) {
      setActive(preferred);
      return;
    }
    setActive(samples[0]?.label ?? '');
  }, [samples]);

  function selectSample(label: string) {
    setActive(label);
    window.localStorage.setItem('igris-api-language', label);
  }

  const current = samples.find((sample) => sample.label === active) ?? samples[0];

  async function copyCode() {
    if (!current) {
      return;
    }

    await navigator.clipboard.writeText(current.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  if (!current) {
    return null;
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="border-b border-gray-200 px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {samples.map((sample) => (
            <button
              key={sample.label}
              type="button"
              onClick={() => selectSample(sample.label)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                sample.label === current.label
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {sample.label}
            </button>
          ))}
          <button
            type="button"
            onClick={copyCode}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            Copy
          </button>
        </div>
      </div>
      <pre className="m-0 overflow-x-auto bg-[#f8f8f6] px-4 py-4 text-xs leading-6 text-slate-900">
        <code>{current.code}</code>
      </pre>
    </div>
  );
}
