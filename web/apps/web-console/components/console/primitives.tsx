'use client';

/**
 * Design primitives for the Igris console — extracted from the inspector
 * page so every lens shares the same look. Matches the canonical product
 * design in web-landing/.../Products.tsx ExecutionPreview.
 *
 * Rules enforced here:
 *   - sans font everywhere (no monospace)
 *   - no uppercase / no wide tracking labels
 *   - dark palette: #0e0e0c surface, #e8e7df foreground, #d3d2c8/#a8a89e/#7a7a72 muted tiers
 */

import React from 'react';

// ── Color tokens ──────────────────────────────────────────────────────────
// Tokens resolve to CSS variables defined in ConsoleStyles below, so the
// console palette flips with the next-themes `html.dark` class. Light mode
// mirrors the web-landing hero (white page, #f9f9fa surface, #e5e7eb borders,
// true-black text, #4b5563 muted). Dark mode keeps the original ink palette.
export const tokens = {
  bg:          'var(--ig-bg)',
  bgRail:      'var(--ig-bg-rail)',
  bgSurface:   'var(--ig-bg-surface)',
  border:      'var(--ig-border)',
  borderSoft:  'var(--ig-border-soft)',
  text:        'var(--ig-text)',
  textPrimary: 'var(--ig-text-primary)',
  textBody:    'var(--ig-text-body)',
  textMuted:   'var(--ig-text-muted)',
  textDim:     'var(--ig-text-dim)',
  textDimmer:  'var(--ig-text-dimmer)',
  textDeepest: 'var(--ig-text-deepest)',
  emerald:     'var(--ig-emerald)',
  rose:        'var(--ig-rose)',
  amber:       'var(--ig-amber)',
} as const;

// ── ConsoleStyles: injects shared CSS once at the shell level ────────────
export function ConsoleStyles() {
  return (
    <style>{`
      /* Console palette — mirrors web-landing Products.tsx ExecutionPreview
         (igris-console / igris-console--light) one-to-one so the live
         console reads identically to the hero mock. */
      :root {
        --ig-bg: #f7f7f5;
        --ig-bg-rail: #f2f1ee;
        --ig-bg-surface: rgba(0,0,0,0.02);
        --ig-border: rgba(0,0,0,0.08);
        --ig-border-soft: rgba(0,0,0,0.06);
        --ig-text: #1b1912;
        --ig-text-primary: #000000;
        --ig-text-body: #2a2820;
        --ig-text-muted: #555248;
        --ig-text-dim: #84817a;
        --ig-text-dimmer: #9a978f;
        --ig-text-deepest: #d6d3cb;
        --ig-emerald: #047857;
        --ig-rose: #be123c;
        --ig-amber: #b45309;
        --ig-bg-pop: #ffffff;
        --ig-pop-shadow: 0 8px 24px rgba(0,0,0,0.12);
        --ig-bg-tooltip: #1b1912;
        --ig-tooltip-text: #f6f6f4;
        --ig-tooltip-shadow: 0 2px 8px rgba(0,0,0,0.18);
        --ig-bg-chip: rgba(0,0,0,0.05);
        --ig-border-chip: rgba(0,0,0,0.06);
        --ig-chip-icon: #6e6b62;
        --ig-rail-active-bg: rgba(0,0,0,0.07);
        --ig-rail-active-mark: #1b1912;
        --ig-avatar-bg: #d8d5cc;
        --ig-dot-border: #f2f1ee;
      }
      html.dark {
        --ig-bg: #0e0e0c;
        --ig-bg-rail: #070707;
        --ig-bg-surface: rgba(255,255,255,0.015);
        --ig-border: rgba(255,255,255,0.06);
        --ig-border-soft: rgba(255,255,255,0.05);
        --ig-text: #e8e7df;
        --ig-text-primary: #f0efe8;
        --ig-text-body: #d3d2c8;
        --ig-text-muted: #a8a89e;
        --ig-text-dim: #7a7a72;
        --ig-text-dimmer: #5a5a52;
        --ig-text-deepest: #3a3a32;
        --ig-emerald: #34d399;
        --ig-rose: #fb7185;
        --ig-amber: #fbbf24;
        --ig-bg-pop: #1a1a17;
        --ig-pop-shadow: 0 8px 24px rgba(0,0,0,0.5);
        --ig-bg-tooltip: #1a1a17;
        --ig-tooltip-text: #f0efe8;
        --ig-tooltip-shadow: 0 2px 8px rgba(0,0,0,0.4);
        --ig-bg-chip: rgba(255,255,255,0.045);
        --ig-border-chip: rgba(255,255,255,0.04);
        --ig-chip-icon: #8a8a82;
        --ig-rail-active-bg: rgba(255,255,255,0.06);
        --ig-rail-active-mark: #f0efe8;
        --ig-avatar-bg: #2a2a25;
        --ig-dot-border: #070707;
      }
      .igris-pane { color-scheme: light; }
      html.dark .igris-pane { color-scheme: dark; }
      .igris-pane .ic-scroll { scrollbar-width: none; -ms-overflow-style: none; }
      .igris-pane .ic-scroll::-webkit-scrollbar { display: none; }
      .igris-pane .ic-chip {
        font-size: 11.5px;
        padding: 1px 6px;
        border-radius: 4px;
        background: var(--ig-bg-chip);
        color: var(--ig-text-body);
        border: 1px solid var(--ig-border-chip);
        white-space: nowrap;
        display: inline-flex;
        align-items: center;
      }
      .igris-pane .ic-chip-icon {
        display: inline-flex;
        align-items: center;
        margin-right: 4px;
        color: var(--ig-chip-icon);
      }
      @keyframes ic-step-in {
        from { opacity: 0; transform: translateY(3px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .igris-pane .ic-step-in { animation: ic-step-in 420ms cubic-bezier(0.16, 0.84, 0.44, 1) both; }
      @keyframes ic-breathe { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
      .igris-pane .ic-breathing { animation: ic-breathe 3.2s ease-in-out infinite; }
      @keyframes ic-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      .igris-pane .ic-live-dot { animation: ic-dot 2.4s ease-in-out infinite; }
      .ig-profile-item[data-highlighted] { background: var(--ig-rail-active); }
    `}</style>
  );
}

// ── Chip ──────────────────────────────────────────────────────────────────
export function Chip({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="ic-chip">
      {icon && <span className="ic-chip-icon">{icon}</span>}
      {children}
    </span>
  );
}

// ── DefRow: labeled value row used in inspector + detail sections ────────
export function DefRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-x-6 py-1.5" style={{ gridTemplateColumns: '90px 1fr' }}>
      <span className="text-[12px]" style={{ color: tokens.textDim }}>{label}</span>
      <div className="text-[12.5px] flex items-center gap-1.5 flex-wrap" style={{ color: tokens.textBody }}>
        {value}
      </div>
    </div>
  );
}

// ── Section: dark inset card with sentence-case title ────────────────────
export function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      {title && (
        <div className="text-[12.5px] mb-2" style={{ color: tokens.textBody, letterSpacing: '-0.005em' }}>
          {title}
        </div>
      )}
      <div
        className="rounded-lg border-[0.5px] px-4 py-3"
        style={{
          background: tokens.bgSurface,
          borderColor: tokens.border,
          boxShadow: 'inset 0 0 0 0.5px rgba(255,255,255,0.03)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ── NotAvail: used wherever real data is absent ──────────────────────────
export function NotAvail() {
  return <span style={{ color: tokens.textDim }}>Not available</span>;
}

// ── digestShort: render a hash digest in sans, never mono ────────────────
export function digestShort(s?: string): string {
  if (!s) return '';
  const [prefix, rest] = s.includes(':') ? s.split(':', 2) : ['', s];
  if (!rest) return s;
  if (rest.length <= 14) return s;
  return `${prefix ? prefix + ':' : ''}${rest.slice(0, 8)}…${rest.slice(-4)}`;
}
