'use client';

/**
 * IconRail — 48px vertical lens switcher on the far left of the console.
 *
 * Each lens is a top-level surface (Tasks, Approvals, Recovery, etc.). The
 * active lens is highlighted; clicking switches the route. Profile lives at
 * the bottom of the rail.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Zap, Box, type LucideIcon,
} from 'lucide-react';
import { tokens } from './primitives';
import { ProfileMenu } from './ProfileMenu';

interface Lens {
  id: string;
  label: string;
  href: string;
  matches: string[]; // path prefixes that activate this lens
  Icon: LucideIcon;
}

const LENSES: Lens[] = [
  { id: 'home',       label: 'Home',       href: '/home',            matches: ['/home'],         Icon: LayoutDashboard },
  { id: 'executions', label: 'Executions', href: '/execution/tasks', matches: ['/execution'],    Icon: Zap },
  { id: 'runtimes',   label: 'Runtimes',   href: '/runtimes',        matches: ['/runtimes'],     Icon: Box },
];

function isActive(pathname: string | null, lens: Lens): boolean {
  if (!pathname) return false;
  return lens.matches.some((m) => pathname === m || pathname.startsWith(m + '/'));
}

function RailItem({ lens, active }: { lens: Lens; active: boolean }) {
  const { Icon, label, href } = lens;
  return (
    <Link
      href={href}
      aria-label={label}
      className="relative flex items-center justify-center h-9 w-9 rounded-md transition-colors group"
      style={{
        background: active ? 'var(--ig-rail-active-bg)' : 'transparent',
        color: active ? 'var(--ig-rail-active-mark)' : tokens.textDim,
      }}
    >
      <Icon className={`h-6 w-6 ${active ? 'opacity-80' : ''}`} strokeWidth={1.5} />
      {active && (
        <span
          className="absolute left-0 top-2 bottom-2 w-[0.5px] rounded-r opacity-80"
          style={{ background: 'var(--ig-rail-active-mark)' }}
        />
      )}
      {/* Hover label — sits in a fixed slot to the right of the 48px rail */}
      <span
        role="tooltip"
        className="pointer-events-none absolute top-1/2 -translate-y-1/2 px-2 py-1 rounded-md whitespace-nowrap text-[11.5px] opacity-0 group-hover:opacity-100 transition-opacity duration-100"
        style={{
          left: 'calc(100% + 12px)',
          background: 'var(--ig-bg-tooltip)',
          color: 'var(--ig-tooltip-text)',
          border: `1px solid ${tokens.borderSoft}`,
          boxShadow: 'var(--ig-tooltip-shadow)',
          zIndex: 60,
        }}
      >
        {label}
      </span>
    </Link>
  );
}

export function IconRail() {
  const pathname = usePathname();
  return (
    <nav
      className="relative flex flex-col items-center py-2 border-r flex-shrink-0"
      style={{
        width: 40,
        background: tokens.bgRail,
        borderColor: tokens.borderSoft,
        zIndex: 40,
      }}
    >
      {/* brand */}
      <Link href="/execution/tasks" className="flex items-center justify-center h-6 w-6 mt-2 mb-6">
        {/* Mirrors landing hero IconRail: /inertia.png on light, /inertiadm.png on dark */}
        <img src="/inertia.png" alt="Igris" className="block select-none h-full w-full object-contain opacity-80 dark:hidden" draggable={false} />
        <img src="/inertiadm.png" alt="" aria-hidden="true" className="hidden dark:block select-none h-full w-full object-contain opacity-80" draggable={false} />
      </Link>

      {/* lenses */}
      <div className="flex flex-col items-center flex-1">
        {LENSES.map((l) => (
          <RailItem key={l.id} lens={l} active={isActive(pathname, l)} />
        ))}
      </div>

      {/* profile (always at bottom — Settings lives inside the profile menu) */}
      <div className="mb-2">
        <ProfileMenu />
      </div>
    </nav>
  );
}

export function activeLensId(pathname: string | null): string | null {
  for (const l of LENSES) {
    if (isActive(pathname, l)) return l.id;
  }
  return null;
}
