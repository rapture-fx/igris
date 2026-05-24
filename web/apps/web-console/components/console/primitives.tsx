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

// ── Color tokens (use these instead of literal hex) ──────────────────────
export const tokens = {
  bg:          '#0e0e0c',
  bgRail:      '#070707',
  bgSurface:   'rgba(255,255,255,0.015)',
  border:      'rgba(255,255,255,0.06)',
  borderSoft:  'rgba(255,255,255,0.05)',
  text:        '#e8e7df',
  textPrimary: '#f0efe8',
  textBody:    '#d3d2c8',
  textMuted:   '#a8a89e',
  textDim:     '#7a7a72',
  textDimmer:  '#5a5a52',
  textDeepest: '#3a3a32',
  emerald:     '#34d399',
  rose:        '#fb7185',
  amber:       '#fbbf24',
} as const;

// ── ConsoleStyles: injects shared CSS once at the shell level ────────────
export function ConsoleStyles() {
  return (
    <style>{`
      .igris-pane { color-scheme: dark; }
      .igris-pane .ic-scroll { scrollbar-width: none; -ms-overflow-style: none; }
      .igris-pane .ic-scroll::-webkit-scrollbar { display: none; }
      .igris-pane .ic-chip {
        font-size: 11.5px;
        padding: 1px 6px;
        border-radius: 4px;
        background: rgba(255,255,255,0.045);
        color: ${tokens.textBody};
        border: 1px solid rgba(255,255,255,0.04);
        white-space: nowrap;
        display: inline-flex;
        align-items: center;
      }
      .igris-pane .ic-chip-icon {
        display: inline-flex;
        align-items: center;
        margin-right: 4px;
        color: #8a8a82;
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
