'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from 'next-themes';

interface CodeBlockProps {
  children?: React.ReactNode;
  className?: string;
}

export function CodeBlock({ children, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // MDX renders <pre><code class="language-X">...</code></pre>
  // Language class is on the inner <code>; plain ``` blocks have no class.
  const allChildren = React.Children.toArray(children);
  const codeEl = (
    allChildren.find((c: any) => c?.props?.className?.includes('language-')) ||
    allChildren.find((c: any) => c?.props !== undefined)
  ) as React.ReactElement<any> | undefined;

  const language = (codeEl?.props?.className || className || '')
    .replace(/language-/, '') || 'text';

  const getTextContent = (node: any): string => {
    if (typeof node === 'string') return node;
    if (Array.isArray(node)) return node.map(getTextContent).join('');
    if (node?.props?.children !== undefined) return getTextContent(node.props.children);
    return '';
  };

  const code = codeEl
    ? (typeof codeEl.props.children === 'string' ? codeEl.props.children : getTextContent(codeEl.props.children))
    : getTextContent(children);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="relative group my-4 rounded-lg overflow-hidden">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-10 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
        aria-label="Copy code"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
      <SyntaxHighlighter
        language={language}
        style={isDark ? oneDark : oneLight}
        customStyle={{
          margin: 0,
          border: 'none',
          borderRadius: '0.5rem',
          padding: '1.25rem',
          fontSize: '0.8125rem',
          lineHeight: '1.6',
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
