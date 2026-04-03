import React from 'react';
import { AlertCircle, AlertTriangle, Lightbulb, Info as InfoIcon, CheckCircle } from 'lucide-react';

interface CalloutProps {
  children: React.ReactNode;
  title?: string;
}

const variants = {
  info: {
    icon: InfoIcon,
    classes: 'border-blue-200 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-950/20',
    titleClasses: 'text-blue-800 dark:text-blue-300',
    iconClasses: 'text-blue-500 dark:text-blue-400',
    defaultTitle: 'Info',
  },
  warning: {
    icon: AlertTriangle,
    classes: 'border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20',
    titleClasses: 'text-amber-800 dark:text-amber-300',
    iconClasses: 'text-amber-500 dark:text-amber-400',
    defaultTitle: 'Warning',
  },
  danger: {
    icon: AlertCircle,
    classes: 'border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-950/20',
    titleClasses: 'text-red-800 dark:text-red-300',
    iconClasses: 'text-red-500 dark:text-red-400',
    defaultTitle: 'Danger',
  },
  tip: {
    icon: Lightbulb,
    classes: 'border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20',
    titleClasses: 'text-emerald-800 dark:text-emerald-300',
    iconClasses: 'text-emerald-500 dark:text-emerald-400',
    defaultTitle: 'Tip',
  },
  success: {
    icon: CheckCircle,
    classes: 'border-green-200 dark:border-green-800/50 bg-green-50/50 dark:bg-green-950/20',
    titleClasses: 'text-green-800 dark:text-green-300',
    iconClasses: 'text-green-500 dark:text-green-400',
    defaultTitle: 'Success',
  },
};

function Callout({ variant, children, title }: CalloutProps & { variant: keyof typeof variants }) {
  const config = variants[variant];
  const Icon = config.icon;
  const displayTitle = title ?? config.defaultTitle;

  return (
    <div className={`my-6 rounded-lg border p-4 ${config.classes}`}>
      <div className="flex gap-3">
        <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${config.iconClasses}`} />
        <div className="min-w-0">
          <div className={`text-sm font-semibold mb-1 ${config.titleClasses}`}>
            {displayTitle}
          </div>
          <div className="text-sm text-gray-700 dark:text-gray-300 prose-sm [&>p]:my-1 [&>code]:text-xs [&>pre]:my-2">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Info(props: CalloutProps) {
  return <Callout variant="info" {...props} />;
}

export function Warning(props: CalloutProps) {
  return <Callout variant="warning" {...props} />;
}

export function Danger(props: CalloutProps) {
  return <Callout variant="danger" {...props} />;
}

export function Tip(props: CalloutProps) {
  return <Callout variant="tip" {...props} />;
}

export function Success(props: CalloutProps) {
  return <Callout variant="success" {...props} />;
}
