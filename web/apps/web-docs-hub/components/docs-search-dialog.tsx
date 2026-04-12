'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { SharedProps, SearchLink } from 'fumadocs-ui/contexts/search';
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogFooter,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
} from 'fumadocs-ui/components/dialog/search';
import { createContentHighlighter, type SortedResult } from 'fumadocs-core/search';

interface SearchEntry {
  title: string;
  path: string;
  description?: string;
  breadcrumbs?: string[];
  keywords?: string;
  content?: string;
}

interface DocsSearchDialogProps extends SharedProps {
  links?: SearchLink[];
}

let entriesPromise: Promise<SearchEntry[]> | undefined;

async function loadEntries(): Promise<SearchEntry[]> {
  if (!entriesPromise) {
    entriesPromise = fetch('/search-index.json').then(async (response) => {
      if (!response.ok) {
        throw new Error('Failed to load docs search index.');
      }

      return response.json() as Promise<SearchEntry[]>;
    });
  }

  return entriesPromise;
}

function scoreEntry(entry: SearchEntry, term: string): number {
  const query = term.toLowerCase();
  const title = entry.title.toLowerCase();
  const path = entry.path.toLowerCase();
  const keywords = (entry.keywords ?? '').toLowerCase();
  const content = (entry.content ?? '').toLowerCase();
  const description = (entry.description ?? '').toLowerCase();

  let score = 0;
  if (title.includes(query)) score += 12;
  if (path.includes(query)) score += 8;
  if (keywords.includes(query)) score += 5;
  if (description.includes(query)) score += 3;
  if (content.includes(query)) score += 1;

  return score;
}

function toDefaultItems(links: SearchLink[]): SortedResult[] {
  return links.map(([name, href]) => ({
    id: href,
    url: href,
    type: 'page',
    content: name,
  }));
}

export function DocsSearchDialog({ open, onOpenChange, links = [] }: DocsSearchDialogProps) {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const [entries, setEntries] = useState<SearchEntry[]>([]);
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setIsLoading(true);

    void loadEntries()
      .then((data) => {
        if (!cancelled) {
          setEntries(data);
          setError(undefined);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load search index.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const items = useMemo<SortedResult[] | null>(() => {
    if (deferredSearch.length === 0) {
      return links.length > 0 ? toDefaultItems(links) : null;
    }

    const highlighter = createContentHighlighter(deferredSearch);

    return entries
      .map((entry) => ({
        entry,
        score: scoreEntry(entry, deferredSearch),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.entry.path.localeCompare(b.entry.path))
      .slice(0, 12)
      .map(({ entry }) => ({
        id: entry.path,
        url: entry.path,
        type: 'page',
        content: entry.title,
        breadcrumbs: entry.breadcrumbs,
        contentWithHighlights: highlighter.highlight(entry.title),
      }));
  }, [deferredSearch, entries, links]);

  return (
    <SearchDialog
      open={open}
      onOpenChange={onOpenChange}
      search={search}
      onSearchChange={setSearch}
      isLoading={isLoading}
    >
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList
          items={items}
          Empty={() => (
            <div className="py-12 text-center text-sm text-fd-muted-foreground">
              {error ?? 'No matching docs found.'}
            </div>
          )}
        />
      </SearchDialogContent>
      <SearchDialogFooter />
    </SearchDialog>
  );
}
