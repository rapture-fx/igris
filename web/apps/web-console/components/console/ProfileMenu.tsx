'use client';

/**
 * ProfileMenu — avatar at the bottom of the icon rail that opens a dark
 * popover with quick actions: License, API Keys, Settings, Documentation,
 * Contact Support, System Status, Theme toggle, Log out. Ports the menu
 * that previously lived in the light Sidebar profile dropdown.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  ActivityLogIcon, EnvelopeClosedIcon, ExitIcon, FileTextIcon, GearIcon,
  LockClosedIcon, MoonIcon, OpenInNewWindowIcon, SunIcon,
} from '@radix-ui/react-icons';
import { useTenant } from '@/hooks/useTenant';
import { useSession, signOut } from '@/lib/auth-client';
import { getInitials } from '@/utils/helpers';
import { tokens } from './primitives';

export function ProfileMenu() {
  const router = useRouter();
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const [showLogout, setShowLogout] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: tenant } = useTenant({ enabled: menuOpen });

  const resolvedName =
    tenant?.name || session?.user?.name || session?.user?.email?.split('@')[0] || 'User';
  const initials = getInitials(resolvedName);
  const email = tenant?.email || session?.user?.email || '';

  const handleLogout = async () => {
    await signOut({ fetchOptions: { onSuccess: () => { window.location.href = '/auth'; } } });
  };

  const menuContentStyle = {
    background: 'var(--ig-bg-pop)',
    borderColor: tokens.borderSoft,
    color: tokens.text,
    boxShadow: 'var(--ig-pop-shadow)',
  };

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            aria-label="Profile menu"
            className="relative flex items-center justify-center h-7 w-7 mt-1 rounded-full select-none outline-none focus:ring-1 overflow-hidden"
            style={{
              background: 'var(--ig-avatar-bg)',
            }}
          >
            <img src="/sfat.png" alt="" className="h-full w-full object-cover" />
            <span
              className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full border"
              style={{ background: tokens.emerald, borderColor: 'var(--ig-dot-border)' }}
            />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          side="right"
          align="end"
          sideOffset={12}
          className="w-64 p-0 rounded-md overflow-hidden"
          style={menuContentStyle}
        >
          {/* header */}
          <div className="px-3 py-3 border-b" style={{ borderColor: tokens.borderSoft }}>
            <p className="text-[12px] font-semibold truncate" style={{ color: tokens.textPrimary }}>
              {resolvedName}
            </p>
            <p className="text-[11px] truncate" style={{ color: tokens.textDim }}>{email}</p>
          </div>

          <ProfileItem icon={<FileTextIcon className="h-3.5 w-3.5" />} label="License" onSelect={() => router.push('/settings/license')} />
          <ProfileItem icon={<LockClosedIcon className="h-3.5 w-3.5" />} label="API Keys" onSelect={() => router.push('/settings/keys')} />
          <ProfileItem icon={<GearIcon className="h-3.5 w-3.5" />} label="Settings" onSelect={() => router.push('/settings/general')} />

          <div className="h-px mx-1" style={{ background: tokens.borderSoft }} />

          <ProfileItem
            icon={<OpenInNewWindowIcon className="h-3.5 w-3.5" />}
            label="Documentation"
            href="https://docs.igrisinertial.com"
            external
          />
          <ProfileItem
            icon={<EnvelopeClosedIcon className="h-3.5 w-3.5" />}
            label="Contact Support"
            href="mailto:support@igrisinertial.com"
          />
          <ProfileItem
            icon={<ActivityLogIcon className="h-3.5 w-3.5" />}
            label="System Status"
            href="https://status.igrisinertial.com"
            external
          />

          <div className="h-px mx-1" style={{ background: tokens.borderSoft }} />

          <ProfileItem
            icon={theme === 'dark' ? <SunIcon className="h-3.5 w-3.5" /> : <MoonIcon className="h-3.5 w-3.5" />}
            label="Theme"
            onSelect={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          />
          <ProfileItem
            icon={<ExitIcon className="h-3.5 w-3.5" />}
            label="Log out"
            onSelect={() => setShowLogout(true)}
            danger
          />
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showLogout} onOpenChange={setShowLogout}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Log out?</DialogTitle>
            <DialogDescription className="text-xs">
              You will be signed out and redirected to the login page.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              className="px-3 h-8 text-xs rounded-md border"
              style={{ borderColor: tokens.borderSoft, background: 'transparent' }}
              onClick={() => setShowLogout(false)}
            >
              Cancel
            </button>
            <button
              className="px-3 h-8 text-xs rounded-md inline-flex items-center gap-1.5"
              style={{ background: '#1b1912', color: '#f6f6f4' }}
              onClick={handleLogout}
            >
              <ExitIcon className="h-3 w-3" />
              Log out
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProfileItem({
  icon, label, onSelect, href, external, danger,
}: {
  icon: React.ReactNode;
  label: string;
  onSelect?: () => void;
  href?: string;
  external?: boolean;
  danger?: boolean;
}) {
  const className = 'ig-profile-item flex items-center justify-between gap-2.5 px-2.5 py-2 text-[12px] cursor-pointer focus:outline-none';
  const color = danger ? tokens.rose : tokens.text;
  if (href) {
    return (
      <DropdownMenuItem asChild className={className} style={{ color }}>
        <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>
          <span>{label}</span>
          <span style={{ color: tokens.textDim }}>{icon}</span>
        </a>
      </DropdownMenuItem>
    );
  }
  return (
    <DropdownMenuItem onSelect={onSelect} className={className} style={{ color }}>
      <span>{label}</span>
      <span style={{ color: tokens.textDim }}>{icon}</span>
    </DropdownMenuItem>
  );
}
