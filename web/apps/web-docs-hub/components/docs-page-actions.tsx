'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, Copy, ExternalLink, FileText, Github } from 'lucide-react';

interface DocsPageActionsProps {
  githubUrl: string;
  markdownUrl: string;
  pageTitle: string;
}

interface AssistantLinkSet {
  chatgpt: string;
  claude: string;
  cursor: string;
  grok: string;
  gemini: string;
  kimi: string;
}

function buildAssistantPrompt(pageTitle: string, pageUrl: string, markdownUrl: string): string {
  return [
    `Review this documentation page: ${pageTitle}`,
    `Page URL: ${pageUrl}`,
    `Markdown source: ${markdownUrl}`,
  ].join('\n');
}

type MenuBrand = 'github' | 'markdown' | 'chatgpt' | 'claude' | 'cursor' | 'grok' | 'gemini' | 'kimi';

function BrandMark({ brand }: { brand: MenuBrand }) {
  if (brand === 'github') {
    return (
      <span className="docs-page-action-brand docs-page-action-brand-github" aria-hidden="true">
        <Github className="size-3.5" />
      </span>
    );
  }

  if (brand === 'markdown') {
    return (
      <span className="docs-page-action-brand docs-page-action-brand-markdown" aria-hidden="true">
        <FileText className="size-3.5" />
      </span>
    );
  }

  const labels: Record<Exclude<MenuBrand, 'github' | 'markdown'>, string> = {
    chatgpt: 'GPT',
    claude: 'AI',
    cursor: 'C',
    grok: 'x',
    gemini: 'G',
    kimi: 'K',
  };

  return (
    <span className={`docs-page-action-brand docs-page-action-brand-${brand}`} aria-hidden="true">
      {labels[brand]}
    </span>
  );
}

export function DocsPageActions({
  githubUrl,
  markdownUrl,
  pageTitle,
}: DocsPageActionsProps) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pageUrl, setPageUrl] = useState('');
  const [absoluteMarkdownUrl, setAbsoluteMarkdownUrl] = useState(markdownUrl);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const article = document.querySelector('.docs-prose');
    if (!article) return;

    const heading = article.querySelector('h1');
    const sibling = heading?.nextElementSibling;
    const anchor =
      sibling?.tagName === 'P'
        ? sibling
        : heading ?? article.firstElementChild ?? null;

    if (!anchor) return;

    const container = document.createElement('div');
    container.className = 'docs-page-actions-anchor';
    anchor.insertAdjacentElement('afterend', container);
    setHost(container);

    return () => {
      container.remove();
      setHost(null);
    };
  }, [markdownUrl]);

  useEffect(() => {
    setOpen(false);
    setCopied(false);
  }, [markdownUrl]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => {
    setPageUrl(window.location.href);
    setAbsoluteMarkdownUrl(new URL(markdownUrl, window.location.origin).toString());
  }, [markdownUrl]);

  const assistantLinks = useMemo<AssistantLinkSet>(() => {
    const prompt = buildAssistantPrompt(pageTitle, pageUrl, absoluteMarkdownUrl);
    const encodedPrompt = encodeURIComponent(prompt);

    return {
      chatgpt: `https://chatgpt.com/?q=${encodedPrompt}`,
      claude: `https://claude.ai/new?q=${encodedPrompt}`,
      cursor: `https://cursor.com/link/prompt?text=${encodedPrompt}`,
      grok: 'https://grok.com/',
      gemini: 'https://gemini.google.com/',
      kimi: 'https://www.kimi.com/open',
    };
  }, [absoluteMarkdownUrl, pageTitle, pageUrl]);

  async function onCopyMarkdown() {
    const response = await fetch(markdownUrl, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Failed to load markdown source.');
    }

    const markdown = await response.text();
    await navigator.clipboard.writeText(markdown);
    setCopied(true);

    window.setTimeout(() => {
      setCopied(false);
    }, 1600);
  }

  if (!host) return null;

  const openItems = [
    { href: githubUrl, label: 'Open in GitHub', brand: 'github' as const },
    { href: markdownUrl, label: 'View as Markdown', brand: 'markdown' as const },
    { href: assistantLinks.chatgpt, label: 'Open in ChatGPT', brand: 'chatgpt' as const },
    { href: assistantLinks.claude, label: 'Open in Claude', brand: 'claude' as const },
    { href: assistantLinks.cursor, label: 'Open in Cursor', brand: 'cursor' as const },
    { href: assistantLinks.grok, label: 'Open in Grok', brand: 'grok' as const },
    { href: assistantLinks.gemini, label: 'Open in Gemini', brand: 'gemini' as const },
    { href: assistantLinks.kimi, label: 'Open in Kimi', brand: 'kimi' as const },
  ];

  return createPortal(
    <div className="docs-page-actions not-prose">
      <button
        type="button"
        className="docs-page-action-button"
        onClick={() => {
          void onCopyMarkdown().catch(() => {
            setCopied(false);
          });
        }}
      >
        <Copy className="size-4" />
        {copied ? 'Copied' : 'Copy Markdown'}
      </button>

      <div ref={menuRef} className="docs-page-action-menu">
        <button
          type="button"
          className="docs-page-action-button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-haspopup="menu"
        >
          <ExternalLink className="size-4" />
          Open
          {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>

        {open ? (
          <div className="docs-page-action-dropdown" role="menu">
            {openItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noreferrer noopener"
                className="docs-page-action-item"
                role="menuitem"
              >
                <BrandMark brand={item.brand} />
                <span>{item.label}</span>
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </div>,
    host,
  );
}
