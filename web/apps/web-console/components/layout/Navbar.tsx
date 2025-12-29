'use client';

import { useState } from 'react';
import { Menu, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Breadcrumbs } from './Breadcrumbs';

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
  const [showNotifications, setShowNotifications] = useState(false);
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

  return (
    <nav className="fixed top-0 left-0 md:left-64 right-0 z-40 h-12 bg-beige-primary md:pl-2 md:pr-2 border-b border-gray-200">
        <div className="h-full px-4 sm:px-6 lg:px-8">
          <div className="flex h-full items-center justify-between">
            {/* Left side - Menu button (mobile only) and Breadcrumbs */}
            <div className="flex items-center gap-4 md:gap-0">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={onMenuClick}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <Breadcrumbs />
            </div>

            {/* Right side - Notifications */}
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
                  <div className="absolute right-0 top-full mt-2 w-80 z-50 bg-beige-primary border border-border-light rounded-lg shadow-lg overflow-hidden">
                    <div className="p-4 border-b border-border-light">
                      <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                      <p className="text-xs text-gray-600 mt-1">{unreadCount} unread</p>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`p-4 border-b border-border-light hover:bg-beige-secondary cursor-pointer ${
                            !notification.read ? 'bg-blue-50' : ''
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
                              <h4 className="text-sm font-medium text-gray-900">{notification.title}</h4>
                              <p className="text-xs text-gray-600 mt-1">{notification.message}</p>
                              <p className="text-xs text-gray-500 mt-1">{notification.timestamp}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-3 border-t border-border-light bg-beige-primary">
                      <button className="text-xs text-gray-600 hover:text-gray-900 font-medium w-full text-center">
                        View All Notifications
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
  );
}
