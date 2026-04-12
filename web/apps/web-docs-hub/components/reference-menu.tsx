'use client';

import Link from 'fumadocs-core/link';
import { usePathname } from 'fumadocs-core/framework';
import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const items = [
  { label: 'Overview', href: '/docs' },
  { label: 'API Reference', href: '/docs/api-reference' },
  { label: 'SDKs', href: '/docs/sdk' },
  { label: 'MCP', href: '/docs/mcp' },
  { label: 'Troubleshooting', href: '/docs/troubleshooting' },
  { label: 'Upgrade & Migration', href: '/docs/upgrade-migration' },
  { label: 'Changelog', href: '/docs/changelog' },
];

export function ReferenceMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const active = items.some((item) =>
    item.href === '/docs' ? pathname === '/docs' : pathname.startsWith(item.href),
  );

  return (
    <div ref={ref} className="relative mb-4">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={[
          'relative flex w-full flex-row items-center gap-2 rounded-lg p-2 ps-(--sidebar-item-offset) text-start [overflow-wrap:anywhere] [&_svg]:size-4 [&_svg]:shrink-0',
          active
            ? 'bg-fd-primary/10 text-fd-primary'
            : 'text-fd-muted-foreground transition-colors hover:bg-fd-accent/50 hover:text-fd-accent-foreground/80 hover:transition-none',
        ].join(' ')}
      >
        Reference
        <ChevronDown className={['ms-auto transition-transform', open ? '' : '-rotate-90'].join(' ')} />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-xl border bg-fd-popover p-1 shadow-xl">
          {items.map((item) => {
            const itemActive =
              item.href === '/docs' ? pathname === '/docs' : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                data-active={itemActive}
                className={[
                  'flex rounded-lg px-3 py-2 text-sm',
                  itemActive
                    ? 'bg-fd-primary/10 text-fd-primary'
                    : 'text-fd-popover-foreground/90 hover:bg-fd-accent/60',
                ].join(' ')}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
