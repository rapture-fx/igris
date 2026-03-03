'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
import { Menu, Bell, LogOut, CreditCard, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTenant } from '@/hooks/useTenant';
import { getInitials } from '@/utils/helpers';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface NavbarProps {
  onMenuClick?: () => void;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  timestamp: string;
  read: boolean;
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const router = useRouter();
  const { signOut } = useClerk();
  const { data: tenant } = useTenant();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [notifications] = useState<Notification[]>([
    {
      id: '1',
      title: 'Provider Fallback',
      message: 'Google provider degraded, traffic routed to Anthropic',
      type: 'warning',
      timestamp: '5 minutes ago',
      read: false,
    },
    {
      id: '2',
      title: 'Device Offline',
      message: 'Runtime instance eu-west-2 went offline',
      type: 'error',
      timestamp: '15 minutes ago',
      read: false,
    },
    {
      id: '3',
      title: 'Training Complete',
      message: 'QLoRA job "custom-agent-v3" finished successfully',
      type: 'success',
      timestamp: '1 hour ago',
      read: true,
    },
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleLogout = async () => {
    await signOut({ redirectUrl: '/auth' });
  };

  return (
    <>
    <nav className="fixed top-0 left-0 md:left-64 right-0 z-40 h-12 bg-background md:pl-12 md:pr-2">
        <div className="h-full px-4 sm:px-6 lg:px-8 md:px-0">
          <div className="flex h-full items-center justify-between">
            {/* Left side - Menu button (mobile only) */}
            <div className="flex items-center gap-4 md:gap-0">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={onMenuClick}
              >
                <Menu className="h-5 w-5" />
              </Button>
            </div>

            {/* Right side - Notifications and Profile */}
            <div className="flex items-center gap-2">
              {/* Notifications */}
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[0.6rem] font-medium text-white">
                      {unreadCount}
                    </span>
                  )}
                </Button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowNotifications(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-80 z-50 bg-background border border-border rounded-lg shadow-lg overflow-hidden">
                    <div className="p-4 border-b border-border">
                      <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
                      <p className="text-xs text-muted-foreground mt-1">{unreadCount} unread</p>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`p-4 border-b border-border hover:bg-muted cursor-pointer ${
                            !notification.read ? 'bg-primary/10' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                              notification.type === 'error' ? 'bg-red-500' :
                              notification.type === 'warning' ? 'bg-yellow-500' :
                              notification.type === 'success' ? 'bg-green-500' :
                              'bg-blue-500'
                            }`} />
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-foreground">{notification.title}</h4>
                              <p className="text-xs text-muted-foreground mt-1">{notification.message}</p>
                              <p className="text-xs text-muted-foreground opacity-75 mt-1">{notification.timestamp}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-3 border-t border-border bg-background">
                      <button className="text-xs text-muted-foreground hover:text-foreground font-medium w-full text-center">
                        View All Notifications
                      </button>
                    </div>
                  </div>
                </>
              )}
              </div>

              {/* Profile */}
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 hover:bg-muted rounded-lg p-1.5 pr-2.5 transition-colors"
                >
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-foreground text-background font-semibold text-[0.65rem]">
                    {tenant ? getInitials(tenant.name) : 'U'}
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>

                {/* Profile Menu Dropdown */}
                {showProfileMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowProfileMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-56 z-50 bg-background border border-border rounded-lg shadow-lg p-2">
                      <div className="px-3 py-2 border-b border-border">
                        <p className="text-xs font-medium font-inter text-foreground">
                          {tenant?.name || 'Profile'}
                        </p>
                        <p className="text-[0.65rem] text-muted-foreground font-inter mt-0.5">
                          {tenant?.email || 'user@example.com'}
                        </p>
                      </div>

                      <button
                        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left mt-1"
                        onClick={() => {
                          setShowProfileMenu(false);
                          // Billing logic will be implemented later
                        }}
                      >
                        <CreditCard className="h-3.5 w-3.5 text-foreground opacity-70" />
                        <div>
                          <p className="text-xs font-medium font-inter text-foreground">Billing</p>
                          <p className="text-[0.65rem] text-muted-foreground font-inter">Manage your subscription</p>
                        </div>
                      </button>

                      <button
                        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left border-t border-border mt-1 pt-2"
                        onClick={() => {
                          setShowProfileMenu(false);
                          setShowLogoutDialog(true);
                        }}
                      >
                        <LogOut className="h-3.5 w-3.5 text-foreground" />
                        <div>
                          <p className="text-xs font-medium font-inter text-foreground">Logout</p>
                          <p className="text-[0.65rem] text-muted-foreground font-inter">Sign out of your account</p>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Logout Confirmation Dialog */}
      <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
            <DialogDescription>
              Are you sure you want to log out of your account?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowLogoutDialog(false)}
              className="w-20 h-8 text-xs rounded-md pl-6"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleLogout}
              className="w-20 h-8 text-xs rounded-md"
              style={{ backgroundColor: '#000000' }}
            >
              Logout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
