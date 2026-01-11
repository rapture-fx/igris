'use client';

import { Inbox, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Empty State UI
 *
 * Shown when there is no data to display.
 * Provides guidance and call-to-action for users.
 */
export function EmptyState({
  title = 'No data yet',
  description = 'Get started by adding your first item',
  icon,
  actionLabel = 'Get Started',
  onAction,
}: EmptyStateProps) {
  const IconComponent = icon || <Inbox className="h-8 w-8 text-gray-400" />;

  return (
    <div className="flex items-center justify-center p-12">
      <Card className="max-w-md w-full border-border-light bg-transparent shadow-none">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            {IconComponent}
          </div>
          <CardTitle className="text-lg font-medium text-gray-900">
            {title}
          </CardTitle>
          <CardDescription className="text-sm text-gray-600 mt-2">
            {description}
          </CardDescription>
        </CardHeader>
        {onAction && (
          <CardContent className="text-center">
            <Button
              onClick={onAction}
              className="flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              {actionLabel}
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
