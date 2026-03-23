import * as React from 'react';
import { cn } from '@/utils/helpers';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, onChange, ...props }, ref) => (
    <input
      type="checkbox"
      ref={ref}
      checked={checked}
      className={cn(
        'h-4 w-4 rounded border border-gray-300 text-gray-900 cursor-pointer',
        'focus:ring-2 focus:ring-gray-900 focus:ring-offset-1',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      onChange={(e) => {
        onChange?.(e);
        onCheckedChange?.(e.target.checked);
      }}
      {...props}
    />
  )
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
