'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, Copy, ExternalLink } from 'lucide-react';

interface DocsPageActionsProps {
  githubUrl: string;
  markdownUrl: string;
  pageTitle: string;
}

function buildAssistantPrompt(pageTitle: string, pageUrl: string, markdownUrl: string): string {
  return [
    `Review this documentation page: ${pageTitle}`,
    `Page URL: ${pageUrl}`,
    `Markdown source: ${markdownUrl}`,
  ].join('\n');
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

  const assistantLinks = useMemo(() => {
    const prompt = buildAssistantPrompt(pageTitle, pageUrl, absoluteMarkdownUrl);

    return {
      chatgpt: `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`,
      claude: `https://claude.ai/new?q=${encodeURIComponent(prompt)}`,
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
            <a
              href={githubUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="docs-page-action-item"
              role="menuitem"
            >
              Open in GitHub
            </a>
            <a
              href={markdownUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="docs-page-action-item"
              role="menuitem"
            >
              View as Markdown
            </a>
            <a
              href={assistantLinks.chatgpt}
              target="_blank"
              rel="noreferrer noopener"
              className="docs-page-action-item"
              role="menuitem"
            >
              Open in ChatGPT
            </a>
            <a
              href={assistantLinks.claude}
              target="_blank"
              rel="noreferrer noopener"
              className="docs-page-action-item"
              role="menuitem"
            >
              Open in Claude
            </a>
          </div>
        ) : null}
      </div>
    </div>,
    host,
  );
}
