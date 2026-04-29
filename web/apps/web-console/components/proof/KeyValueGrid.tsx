'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface KVItem {
  label: string;
  value: React.ReactNode;
  copyable?: boolean;
  copyValue?: string;
  href?: string;
}

export function KeyValueGrid({ items }: { items: KVItem[] }) {
  const [copiedKey, setCopiedKey] = useState('');

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 1500);
  };

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-3">
      {items.map(({ label, value, copyable, copyValue, href }) => (
        <React.Fragment key={label}>
          <dt className="text-xs text-gray-400 whitespace-nowrap pt-px leading-4">{label}</dt>
          <dd className="flex items-start gap-1.5 min-w-0">
            {href ? (
              <a href={href} className="text-xs text-blue-600 hover:text-blue-700 underline underline-offset-2 break-all">
                {value}
              </a>
            ) : (
              <span className="text-xs text-gray-800 dark:text-gray-200 break-all leading-4">
                {value ?? <span className="text-gray-300">—</span>}
              </span>
            )}
            {copyable && copyValue && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => copy(copyValue, label)}
                title="Copy"
                className="h-4 w-4 flex-shrink-0 mt-0.5 text-gray-300 hover:text-gray-600 hover:bg-transparent"
              >
                {copiedKey === label
                  ? <Check className="h-3 w-3 text-green-500" />
                  : <Copy className="h-3 w-3" />}
              </Button>
            )}
          </dd>
        </React.Fragment>
      ))}
    </dl>
  );
}
