'use client';

import { useEffect, useMemo, useState } from 'react';

export type DraftTargetType = 'mock_demo' | 'webhook' | 'api' | 'local_runtime';
export type DraftPolicyPreset = 'Safe automation' | 'Human-gated' | 'Non-replayable' | 'Read-only';

export interface ActionDraft {
  id: string;
  actionName: string;
  description: string;
  targetType: DraftTargetType;
  targetUrl: string;
  method: string;
  policyPreset: DraftPolicyPreset;
  replayClass: 'replayable' | 'non_replayable' | 'read_only';
  approvalRequired: boolean;
  createdAt: string;
  updatedAt: string;
  endpointCopied?: boolean;
}

const STORAGE_KEY = 'igris-console-action-drafts-v1';

export function slugifyActionName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_ -]/g, '').replace(/[\s-]+/g, '_');
}

function readDrafts(): ActionDraft[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeDrafts(drafts: ActionDraft[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
}

export function useActionDrafts() {
  const [drafts, setDrafts] = useState<ActionDraft[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setDrafts(readDrafts());
    setLoaded(true);
  }, []);

  const sorted = useMemo(
    () => [...drafts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [drafts],
  );

  const saveDraft = (draft: Omit<ActionDraft, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    const now = new Date().toISOString();
    const id = draft.id || slugifyActionName(draft.actionName) || `action_${Date.now()}`;
    let saved!: ActionDraft;
    setDrafts((current) => {
      const existing = current.find((item) => item.id === id);
      saved = {
        ...draft,
        id,
        actionName: slugifyActionName(draft.actionName),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      const next = [saved, ...current.filter((item) => item.id !== id)];
      writeDrafts(next);
      return next;
    });
    return saved;
  };

  const markEndpointCopied = (id: string) => {
    setDrafts((current) => {
      const next = current.map((item) =>
        item.id === id ? { ...item, endpointCopied: true, updatedAt: new Date().toISOString() } : item,
      );
      writeDrafts(next);
      return next;
    });
  };

  return { drafts: sorted, loaded, saveDraft, markEndpointCopied };
}
