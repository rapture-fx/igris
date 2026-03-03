'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export interface KVItem {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  copyable?: boolean;
  copyValue?: string;
  href?: string;
}

interface KeyValueGridProps {
  items: KVItem[];
}

export function KeyValueGrid({ items }: KeyValueGridProps) {
  const [copiedKey, setCopiedKey] = useState('');

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 1500);
  };

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-3">
      {items.map(({ label, value, mono, copyable, copyValue, href }) => (
        <>
          <dt key={`dt-${label}`} className="text-xs text-gray-400 whitespace-nowrap pt-px leading-4">{label}</dt>
          <dd key={`dd-${label}`} className="flex items-start gap-1.5 min-w-0">
            {href ? (
              <a
                href={href}
                className="text-xs text-blue-600 hover:text-blue-700 underline underline-offset-2 break-all"
              >
                {value}
              </a>
            ) : (
              <span className={`text-xs text-gray-800 break-all leading-4 ${mono ? '' : ''}`}>
                {value ?? <span className="text-gray-300">—</span>}
              </span>
            )}
            {copyable && copyValue && (
              <button
                onClick={() => copy(copyValue, label)}
                className="flex-shrink-0 mt-0.5 text-gray-300 hover:text-gray-600 transition-colors"
                title="Copy"
              >
                {copiedKey === label
                  ? <Check className="h-3 w-3 text-green-500" />
                  : <Copy className="h-3 w-3" />}
              </button>
            )}
          </dd>
        </>
      ))}
    </dl>
  );
}
