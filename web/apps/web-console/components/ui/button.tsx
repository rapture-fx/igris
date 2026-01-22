import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/helpers';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-xl text-sm font-medium font-inter transition-all duration-200 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 shadow-md hover:shadow-lg',
        destructive: 'bg-red-500 text-white hover:bg-red-600 shadow-sm',
        outline: 'border border-border-light dark:border-border bg-transparent hover:bg-beige-primary dark:hover:bg-muted text-foreground',
        secondary: 'bg-gray-700 text-white hover:bg-gray-600 shadow-sm',
        ghost: 'hover:bg-beige-primary dark:hover:bg-muted hover:text-foreground',
        link: 'text-gray-900 dark:text-gray-100 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-5 py-2.5',
        sm: 'h-8 rounded-lg px-3 text-xs',
        lg: 'h-12 rounded-xl px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
