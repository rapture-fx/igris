'use client';

import { useState, useRef, useEffect } from 'react';
import { Copy, ChevronDown, Check, ArrowUpRight } from 'lucide-react';

export function CopyPageButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopyPage = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setIsOpen(false);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getCurrentPageUrl = () => window.location.href;

  const getMarkdownContent = async () => {
    const content = document.querySelector('.prose')?.textContent || '';
    return content;
  };

  const menuItems = [
    {
      label: 'Open to Claude',
      action: async () => {
        const url = getCurrentPageUrl();
        await handleCopyToClipboard(`Open this documentation: ${url}`);
      },
    },
    {
      label: 'Cursor',
      action: async () => {
        const url = getCurrentPageUrl();
        await handleCopyToClipboard(url);
      },
    },
    {
      label: 'VS Code',
      action: async () => {
        const url = getCurrentPageUrl();
        await handleCopyToClipboard(url);
      },
    },
    {
      label: 'View as Markdown',
      action: async () => {
        const content = await getMarkdownContent();
        await handleCopyToClipboard(content);
      },
    },
    {
      label: 'Open to ChatGPT',
      action: async () => {
        const url = getCurrentPageUrl();
        await handleCopyToClipboard(`Read this documentation: ${url}`);
      },
    },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="inline-flex items-center rounded-lg border border-gray-200 overflow-hidden transition-colors shadow-sm bg-beige-primary">
        {/* Copy button */}
        <button
          onClick={handleCopyPage}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-900 hover:bg-beige-secondary transition-colors"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy page</span>
            </>
          )}
        </button>

        {/* Dropdown toggle */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="px-2 py-1.5 border-l border-gray-200 text-gray-900 hover:bg-beige-secondary transition-colors"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-44 bg-beige-primary border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={item.action}
              className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-beige-secondary transition-colors border-b border-gray-100 last:border-b-0 flex items-center justify-between gap-2"
            >
              <span>{item.label}</span>
              <ArrowUpRight className="h-3 w-3 text-gray-400 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
